import { afterEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { runDailyEmails } from "@/server/email/daily"

const toClean: string[] = []
const DAY = 24 * 60 * 60 * 1000

/**
 * Testin "şimdi"si GEÇMİŞTE (2020): sorgular veritabanının tamamına bakıyor
 * ve geliştirme veritabanı paylaşılıyor. 2020'ye çekilince yalnızca bu
 * testin ürettiği kayıtlar pencereye giriyor. 07:00 UTC = 10:00 TR.
 */
const NOW = new Date("2020-06-01T07:00:00.000Z")
const TOMORROW = new Date("2020-06-02T00:00:00.000Z")

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser(
  label: string,
  extra: { isAnonymous?: boolean; applicationReminders?: boolean; accessUpdates?: boolean; productNews?: boolean; createdAt?: Date } = {},
) {
  const u = await prisma.user.create({ data: { name: label, email: `${label}-${Date.now()}-${Math.random()}@test.local`, ...extra } })
  toClean.push(u.id)
  return u
}

async function makeAnalysis(
  userId: string,
  data: { stage?: string; daysAgo?: number; interviewAt?: Date; deadline?: Date; adapted?: boolean; position?: string },
) {
  const posting = await prisma.jobPosting.create({
    data: { userId, rawText: "ilan", requirements: [], language: "tr", position: data.position ?? "Muhasebe Uzmanı", company: "Atlas", deadline: data.deadline ?? null },
  })
  const analysis = await prisma.analysis.create({
    data: {
      userId,
      jobPostingId: posting.id,
      modelId: "test",
      status: "done",
      score: 42,
      stage: (data.stage ?? "saved") as never,
      stageChangedAt: new Date(NOW.getTime() - (data.daysAgo ?? 0) * DAY),
      interviewAt: data.interviewAt ?? null,
    },
  })
  if (data.adapted) {
    await prisma.adaptation.create({ data: { analysisId: analysis.id, draft: {}, modelId: "test", status: "ready", createdAt: NOW } })
  }
  return analysis
}

function fakeClient() {
  return {
    emails: {
      send: vi.fn(async (_args: { to: string; subject: string; text?: string; replyTo?: string; headers?: Record<string, string> }) => ({
        data: { id: `re_${Math.random()}` },
        error: null,
      })),
    },
  }
}

describe("runDailyEmails · başvuru hatırlatmaları (DOG-98, DOG-128, DOG-120)", () => {
  it("bundles follow-up, tomorrow's interview and a near deadline into one e-mail, then never again", async () => {
    const user = await makeUser("toplu")
    const followup = await makeAnalysis(user.id, { stage: "applied", daysAgo: 8 })
    await makeAnalysis(user.id, { stage: "interview", interviewAt: TOMORROW, adapted: true, position: "Finans Uzmanı" })
    await makeAnalysis(user.id, { stage: "saved", deadline: new Date("2020-06-03T00:00:00Z"), adapted: true, position: "Bütçe Uzmanı" })
    const client = fakeClient()

    const first = await runDailyEmails(prisma, { now: NOW, dryRun: false, client })
    expect(first).toMatchObject({ sent: 1, failed: 0 })
    expect(first.byKind).toEqual({ application_followup: 1, interview_reminder: 1, deadline_reminder: 1 })
    expect(client.emails.send).toHaveBeenCalledTimes(1)
    const sent = client.emails.send.mock.calls[0]![0]
    expect(sent.subject).toBe("Yarın Atlas mülakatın var")
    expect(sent.text).toContain("Finans Uzmanı · Atlas")
    expect(sent.text).toContain("Bütçe Uzmanı · Atlas")
    expect(sent.text).toContain("Muhasebe Uzmanı · Atlas")
    expect(sent.replyTo).toBe("iletisim@uyarla.com.tr")
    expect((await prisma.analysis.findUnique({ where: { id: followup.id } }))!.reminderSentAt).toEqual(NOW)
    expect(await prisma.emailLog.count({ where: { userId: user.id } })).toBe(3)

    // Ertesi gün aynı şeyler yeniden gitmiyor.
    const again = await runDailyEmails(prisma, { now: new Date(NOW.getTime() + DAY), dryRun: false, client })
    expect(again.sent).toBe(0)
    expect(client.emails.send).toHaveBeenCalledTimes(1)
  })

  it("skips opted-out and anonymous users, unadapted deadlines and rejected interviews", async () => {
    const off = await makeUser("kapali", { applicationReminders: false })
    await makeAnalysis(off.id, { stage: "interview", interviewAt: TOMORROW })
    const anon = await makeUser("anonim", { isAnonymous: true })
    await makeAnalysis(anon.id, { stage: "applied", daysAgo: 8 })
    const user = await makeUser("atlanan")
    await makeAnalysis(user.id, { stage: "saved", deadline: new Date("2020-06-02T00:00:00Z") }) // uyarlanmamış
    await makeAnalysis(user.id, { stage: "rejected", interviewAt: TOMORROW })
    await makeAnalysis(user.id, { stage: "saved", deadline: new Date("2020-06-10T00:00:00Z"), adapted: true }) // uzak

    const result = await runDailyEmails(prisma, { now: NOW, dryRun: true })
    expect(result.users).toBe(0)
  })

  it("keeps a failed e-mail unmarked so it is retried", async () => {
    const user = await makeUser("hatali")
    const a = await makeAnalysis(user.id, { stage: "applied", daysAgo: 8 })
    const client = { emails: { send: vi.fn(async () => ({ data: null, error: { message: "reddedildi" } })) } }
    const result = await runDailyEmails(prisma, { now: NOW, dryRun: false, client })
    expect(result).toMatchObject({ sent: 0, failed: 1 })
    expect((await prisma.analysis.findUnique({ where: { id: a.id } }))!.reminderSentAt).toBeNull()
    expect(await prisma.emailLog.count({ where: { userId: user.id } })).toBe(0)
  })
})

describe("runDailyEmails · teşekkür notu (DOG-117)", () => {
  it("suggests a thank-you note the day after an interview, once", async () => {
    const user = await makeUser("tesekkur")
    await makeAnalysis(user.id, { stage: "interview", interviewAt: new Date("2020-05-31T00:00:00Z"), position: "Finans Uzmanı" })
    const client = fakeClient()
    expect(await runDailyEmails(prisma, { now: NOW, dryRun: false, client })).toMatchObject({ sent: 1, byKind: { thanks_reminder: 1 } })
    expect(client.emails.send.mock.calls[0]![0].subject).toBe("Mülakatın için teşekkür notu")
    expect((await runDailyEmails(prisma, { now: new Date(NOW.getTime() + DAY), dryRun: true })).byKind).toEqual({})
  })
})

describe("runDailyEmails · sıklık sınırı (DOG-126)", () => {
  it("defers a follow-up when an e-mail went out in the last 20 hours, but not tomorrow's interview", async () => {
    const user = await makeUser("sinir")
    await prisma.emailLog.create({ data: { userId: user.id, kind: "access_ending", category: "accessUpdates", sentAt: new Date(NOW.getTime() - 3 * 36e5) } })
    await makeAnalysis(user.id, { stage: "applied", daysAgo: 8 })
    expect(await runDailyEmails(prisma, { now: NOW, dryRun: true })).toMatchObject({ deferred: 1, byKind: {} })

    await makeAnalysis(user.id, { stage: "interview", interviewAt: TOMORROW })
    const withInterview = await runDailyEmails(prisma, { now: NOW, dryRun: true })
    expect(withInterview.byKind).toMatchObject({ interview_reminder: 1 })
  })
})

describe("runDailyEmails · erişim dönemi (DOG-129)", () => {
  async function pass(userId: string, startsAt: Date, endsAt: Date) {
    return prisma.accessPass.create({ data: { userId, plan: "week", providerOrderId: `o-${Math.random()}`, startsAt, endsAt } })
  }

  it("tells a user who used the pass that it ends in two days, once", async () => {
    process.env.EMAIL_LINK_SECRET = "test-anahtar"
    const user = await makeUser("donem")
    await pass(user.id, new Date(NOW.getTime() - 5 * DAY), new Date(NOW.getTime() + 36 * 36e5))
    await makeAnalysis(user.id, { adapted: true })
    const client = fakeClient()
    expect(await runDailyEmails(prisma, { now: NOW, dryRun: false, client })).toMatchObject({ sent: 1, byKind: { access_ending: 1 } })
    expect(client.emails.send.mock.calls[0]![0].subject).toContain("tarihinde bitiyor")
    // Kapatılabilen kategori: tek tıkla çıkış başlıkları var.
    expect(client.emails.send.mock.calls[0]![0].headers).toHaveProperty("List-Unsubscribe-Post")
    delete process.env.EMAIL_LINK_SECRET
    expect((await runDailyEmails(prisma, { now: new Date(NOW.getTime() + 3 * 36e5), dryRun: true })).byKind).toEqual({})
  })

  it("stays silent for an unused pass, a stacked pass and an opted-out user", async () => {
    const unused = await makeUser("kullanmayan")
    await pass(unused.id, new Date(NOW.getTime() - 5 * DAY), new Date(NOW.getTime() + DAY))
    const stacked = await makeUser("ust-uste")
    const first = await pass(stacked.id, new Date(NOW.getTime() - 5 * DAY), new Date(NOW.getTime() + DAY))
    await pass(stacked.id, first.endsAt, new Date(first.endsAt.getTime() + 7 * DAY))
    await makeAnalysis(stacked.id, { adapted: true })
    const off = await makeUser("kapatan", { accessUpdates: false })
    await pass(off.id, new Date(NOW.getTime() - 5 * DAY), new Date(NOW.getTime() + DAY))
    await makeAnalysis(off.id, { adapted: true })
    expect((await runDailyEmails(prisma, { now: NOW, dryRun: true })).byKind).toEqual({})
  })
})

describe("runDailyEmails · ürün haberleri (DOG-130)", () => {
  const created = new Date(NOW.getTime() - 3 * DAY)

  it("sends activation only with consent and the switch on", async () => {
    const consenting = await makeUser("onayli", { productNews: true, createdAt: created })
    await prisma.resume.create({ data: { userId: consenting.id, filePath: "x", rawText: "cv" } })
    const silent = await makeUser("onaysiz", { createdAt: created })
    await prisma.resume.create({ data: { userId: silent.id, filePath: "x", rawText: "cv" } })

    expect((await runDailyEmails(prisma, { now: NOW, dryRun: true, productEmails: false })).byKind).toEqual({})
    const on = await runDailyEmails(prisma, { now: NOW, dryRun: true, productEmails: true })
    expect(on.byKind).toEqual({ activation_no_analysis: 1 })
  })

  it("nudges an analysed but unadapted user toward the free adaptation", async () => {
    const user = await makeUser("ucretsiz", { productNews: true, createdAt: created })
    await prisma.resume.create({ data: { userId: user.id, filePath: "x", rawText: "cv" } })
    await makeAnalysis(user.id, {})
    expect((await runDailyEmails(prisma, { now: NOW, dryRun: true, productEmails: true })).byKind).toEqual({ activation_free_unused: 1 })
  })
})
