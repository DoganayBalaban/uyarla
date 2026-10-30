import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { claimAnonymousData, claimOperations } from "@/server/claimAnonymousData"

const toClean: string[] = []

afterEach(async () => {
  // Sıra önemli: yabancı anahtarlar önce çocukları istiyor.
  await prisma.analysis.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.resume.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.user.deleteMany({ where: { id: { in: toClean } } })
  toClean.length = 0
})

async function makeUser(userName: string) {
  const u = await prisma.user.create({
    data: { name: userName, email: `${userName}-${Date.now()}-${Math.random()}@test.local` },
  })
  toClean.push(u.id)
  return u
}

async function makeJob(userId: string) {
  const resume = await prisma.resume.create({
    data: { userId, filePath: "/tmp/x.pdf", rawText: "metin" },
  })
  const posting = await prisma.jobPosting.create({
    data: { userId, rawText: "ilan", requirements: [], language: "tr" },
  })
  const analysis = await prisma.analysis.create({
    data: { userId, jobPostingId: posting.id, modelId: "test", status: "done", score: 42 },
  })
  return { resume, posting, analysis }
}

describe("claim · real database", () => {
  it("moves the anonymous user's work to the new account", async () => {
    const anonUser = await makeUser("anonim")
    const fresh = await makeUser("yeni")
    const { resume, posting, analysis } = await makeJob(anonUser.id)

    await prisma.$transaction(claimOperations(prisma, anonUser.id, fresh.id))

    expect((await prisma.resume.findUnique({ where: { id: resume.id } }))!.userId).toBe(fresh.id)
    expect((await prisma.analysis.findUnique({ where: { id: analysis.id } }))!.userId).toBe(
      fresh.id,
    )
    expect((await prisma.jobPosting.findUnique({ where: { id: posting.id } }))!.userId).toBe(
      fresh.id,
    )
  })

  it("does NOT touch other users' data", async () => {
    // Bu testin varlık sebebi: where koşulu düşerse bütün kullanıcıların
    // verisi tek hesaba taşınır ve bu kişisel veri sızıntısıdır.
    const anonUser = await makeUser("anonim")
    const fresh = await makeUser("yeni")
    const otherUser = await makeUser("baskasi")

    await makeJob(anonUser.id)
    const othersJob = await makeJob(otherUser.id)

    await prisma.$transaction(claimOperations(prisma, anonUser.id, fresh.id))

    const othersResume = await prisma.resume.findUnique({
      where: { id: othersJob.resume.id },
    })
    expect(othersResume!.userId).toBe(otherUser.id)
    const othersAnalysis = await prisma.analysis.findUnique({
      where: { id: othersJob.analysis.id },
    })
    expect(othersAnalysis!.userId).toBe(otherUser.id)
  })

  it("passes silently when there is nothing to move", async () => {
    const anonUser = await makeUser("anonim")
    const fresh = await makeUser("yeni")
    await expect(
      prisma.$transaction(claimOperations(prisma, anonUser.id, fresh.id)),
    ).resolves.toBeDefined()
  })
})

describe("claimAnonymousData · the analyzed CV joins the library (DOG-166)", () => {
  it("saves the newest claimed CV as the default when the new account has none", async () => {
    // Kullanıcı testi: kayıttan sonra CV'lerim boştu, kurulum CV'yi yeniden istedi.
    const anonUser = await makeUser("anonim")
    const fresh = await makeUser("yeni")
    const older = await prisma.resume.create({ data: { userId: anonUser.id, filePath: "/tmp/eski.pdf", rawText: "", createdAt: new Date("2026-10-01") } })
    const { resume: newest } = await makeJob(anonUser.id)

    await claimAnonymousData(prisma, anonUser.id, fresh.id)

    const saved = await prisma.resume.findMany({ where: { userId: fresh.id, savedAt: { not: null } } })
    expect(saved.map((r) => [r.id, r.isDefault])).toEqual([[newest.id, true]])
    expect((await prisma.resume.findUnique({ where: { id: older.id } }))!.userId).toBe(fresh.id)
  })

  it("leaves an existing library alone", async () => {
    const anonUser = await makeUser("anonim")
    const fresh = await makeUser("yeni")
    const own = await prisma.resume.create({ data: { userId: fresh.id, filePath: "/tmp/kendi.pdf", rawText: "", savedAt: new Date(), isDefault: true } })
    const { resume: claimed } = await makeJob(anonUser.id)

    await claimAnonymousData(prisma, anonUser.id, fresh.id)

    expect((await prisma.resume.findUnique({ where: { id: claimed.id } }))!.savedAt).toBeNull()
    expect((await prisma.resume.findUnique({ where: { id: own.id } }))!.isDefault).toBe(true)
  })
})
