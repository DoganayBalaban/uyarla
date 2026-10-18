import { describe, it, expect, afterEach, vi } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { sendApplicationReminders } from "@/server/applicationReminders"

const toClean: string[] = []
const DAY = 24 * 60 * 60 * 1000

/**
 * Testin "şimdi"si GEÇMİŞTE (2020): sorgu veritabanının tamamına bakıyor ve
 * geliştirme veritabanı paylaşılıyor. Kesim 2020'ye çekilince yalnızca bu
 * testin ürettiği kayıtlar pencereye giriyor (bkz. cleanupAnonymousUsers).
 */
const NOW = new Date("2020-06-01T12:00:00.000Z")

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser(label: string, extra: { isAnonymous?: boolean; applicationReminders?: boolean } = {}) {
  const u = await prisma.user.create({
    data: { name: label, email: `${label}-${Date.now()}-${Math.random()}@test.local`, ...extra },
  })
  toClean.push(u.id)
  return u
}

async function makeApplication(userId: string, stage: "applied" | "interview", daysAgo: number, position = "Muhasebe Uzmanı") {
  const posting = await prisma.jobPosting.create({
    data: { userId, rawText: "ilan", requirements: [], language: "tr", position, company: "Atlas" },
  })
  return prisma.analysis.create({
    data: {
      userId,
      jobPostingId: posting.id,
      modelId: "test",
      status: "done",
      score: 42,
      stage,
      stageChangedAt: new Date(NOW.getTime() - daysAgo * DAY),
    },
  })
}

function fakeClient() {
  return {
    emails: { send: vi.fn(async (_args: { to: string; text?: string }) => ({ data: {}, error: null })) },
  }
}

describe("application reminders · real database (DOG-98)", () => {
  it("sends one e-mail per user for applications quiet for a week, then never again", async () => {
    const user = await makeUser("hatirlatma")
    const a = await makeApplication(user.id, "applied", 8)
    const b = await makeApplication(user.id, "applied", 10, "Finans Uzmanı")
    const client = fakeClient()

    const first = await sendApplicationReminders(prisma, { now: NOW, dryRun: false, client })
    expect(first).toEqual({ users: 1, applications: 2, sent: 1, failed: 0 })
    expect(client.emails.send).toHaveBeenCalledTimes(1)
    const sent = client.emails.send.mock.calls[0]![0]
    expect(sent.to).toBe(user.email)
    expect(sent.text).toContain("Muhasebe Uzmanı · Atlas")
    expect(sent.text).toContain("Finans Uzmanı · Atlas")

    const rows = await prisma.analysis.findMany({ where: { id: { in: [a.id, b.id] } }, select: { reminderSentAt: true } })
    expect(rows.every((r) => r.reminderSentAt?.getTime() === NOW.getTime())).toBe(true)

    const second = await sendApplicationReminders(prisma, { now: NOW, dryRun: false, client })
    expect(second.applications).toBe(0)
    expect(client.emails.send).toHaveBeenCalledTimes(1)
  })

  it("skips too fresh, too old, moved-on, opted-out and anonymous applications", async () => {
    const user = await makeUser("atlanan")
    await makeApplication(user.id, "applied", 3) // daha bir hafta olmadı
    await makeApplication(user.id, "applied", 40) // pencerenin dışında
    await makeApplication(user.id, "interview", 10) // aşama ilerledi
    const optedOut = await makeUser("kapatan", { applicationReminders: false })
    await makeApplication(optedOut.id, "applied", 8)
    const anon = await makeUser("anonim", { isAnonymous: true })
    await makeApplication(anon.id, "applied", 8)

    const result = await sendApplicationReminders(prisma, { now: NOW, dryRun: true })
    expect(result).toEqual({ users: 0, applications: 0, sent: 0, failed: 0 })
  })

  it("does not mark applications whose e-mail failed; they are retried", async () => {
    const user = await makeUser("hatali")
    const a = await makeApplication(user.id, "applied", 8)
    const client = { emails: { send: vi.fn(async () => ({ data: null, error: { message: "reddedildi" } })) } }

    const result = await sendApplicationReminders(prisma, { now: NOW, dryRun: false, client })
    expect(result).toMatchObject({ sent: 0, failed: 1 })
    expect((await prisma.analysis.findUnique({ where: { id: a.id } }))!.reminderSentAt).toBeNull()
  })

  it("does not need an e-mail key on a day with nothing to send", async () => {
    const key = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      await expect(sendApplicationReminders(prisma, { now: NOW, dryRun: false })).resolves.toMatchObject({ sent: 0 })
    } finally {
      if (key !== undefined) process.env.RESEND_API_KEY = key
    }
  })
})
