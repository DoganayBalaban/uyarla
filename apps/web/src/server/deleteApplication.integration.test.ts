import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { loadUsage } from "@/server/billing/entitlement"
import { deletionOperations } from "@/server/deleteAccount"
import { ApplicationNotFoundError, deleteApplication } from "@/server/deleteApplication"

const toClean: string[] = []
const NOW = new Date()

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser(name: string) {
  const u = await prisma.user.create({ data: { name, email: `${name}-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}

/** Bir başvuru: CV (kütüphanede ya da değil), ilan, analiz ve isteğe bağlı uyarlama. */
async function makeApplication(userId: string, opts: { saved?: boolean; adapted?: boolean; status?: "done" | "failed"; resumeId?: string } = {}) {
  const resume = opts.resumeId
    ? await prisma.resume.findUniqueOrThrow({ where: { id: opts.resumeId } })
    : await prisma.resume.create({ data: { userId, filePath: `/tmp/yok-${Math.random()}.pdf`, rawText: "cv", savedAt: opts.saved ? new Date() : null } })
  const versionNo = (await prisma.resumeVersion.count({ where: { resumeId: resume.id } })) + 1
  const version = await prisma.resumeVersion.create({ data: { resumeId: resume.id, profile: {}, source: "parsed", versionNo } })
  const posting = await prisma.jobPosting.create({ data: { userId, rawText: "ilan", requirements: [], language: "tr" } })
  const analysis = await prisma.analysis.create({
    data: { userId, jobPostingId: posting.id, resumeVersionId: version.id, modelId: "m", status: opts.status ?? "done", note: "notum" },
  })
  let adaptedVersionId: string | null = null
  if (opts.adapted) {
    const adapted = await prisma.resumeVersion.create({ data: { resumeId: resume.id, profile: {}, source: "adapted", versionNo: versionNo + 1 } })
    adaptedVersionId = adapted.id
    await prisma.adaptation.create({ data: { analysisId: analysis.id, draft: {}, modelId: "m", status: "ready", resumeVersionId: adapted.id } })
  }
  return { resume, version, posting, analysis, adaptedVersionId }
}

describe("deleteApplication (DOG-171)", () => {
  it("removes the application with its posting, adaptation and adapted CV, keeping the library CV", async () => {
    const u = await makeUser("silen")
    const app = await makeApplication(u.id, { saved: true, adapted: true })

    await deleteApplication(prisma, u.id, app.analysis.id)

    expect(await prisma.analysis.findUnique({ where: { id: app.analysis.id } })).toBeNull()
    expect(await prisma.jobPosting.findUnique({ where: { id: app.posting.id } })).toBeNull()
    expect(await prisma.adaptation.count({ where: { analysisId: app.analysis.id } })).toBe(0)
    expect(await prisma.resumeVersion.findUnique({ where: { id: app.adaptedVersionId! } })).toBeNull()
    // Kütüphanedeki CV ve okunmuş sürümü duruyor: başka başvurularda kullanılıyor.
    expect(await prisma.resume.findUnique({ where: { id: app.resume.id } })).not.toBeNull()
    expect(await prisma.resumeVersion.findUnique({ where: { id: app.version.id } })).not.toBeNull()
  })

  it("also removes a CV uploaded only for this application and returns its file to delete", async () => {
    const u = await makeUser("tek")
    const app = await makeApplication(u.id, { saved: false })
    const { files } = await deleteApplication(prisma, u.id, app.analysis.id)
    expect(await prisma.resume.findUnique({ where: { id: app.resume.id } })).toBeNull()
    expect(files).toEqual([app.resume.filePath])
  })

  it("keeps an unsaved CV another application still uses", async () => {
    const u = await makeUser("ortak")
    const first = await makeApplication(u.id, { saved: false })
    await makeApplication(u.id, { resumeId: first.resume.id })
    const { files } = await deleteApplication(prisma, u.id, first.analysis.id)
    expect(await prisma.resume.findUnique({ where: { id: first.resume.id } })).not.toBeNull()
    expect(files).toEqual([])
  })

  it("does not give the free quota back", async () => {
    // Yoksa ücretsiz kullanıcı "analiz et, sil, yeniden analiz et" ile ayın sınırını aşardı.
    const u = await makeUser("kota")
    const app = await makeApplication(u.id, { adapted: true })
    const before = (await loadUsage(prisma, u.id, NOW)).usage
    await deleteApplication(prisma, u.id, app.analysis.id)
    expect((await loadUsage(prisma, u.id, NOW)).usage).toEqual(before)
    expect(before).toMatchObject({ analysesThisMonth: 1, adaptationsThisMonth: 1 })
  })

  it("leaves no usage behind for a failed analysis, which never counted", async () => {
    const u = await makeUser("basarisiz")
    const app = await makeApplication(u.id, { status: "failed" })
    await deleteApplication(prisma, u.id, app.analysis.id)
    expect((await loadUsage(prisma, u.id, NOW)).usage.analysesThisMonth).toBe(0)
  })

  it("refuses someone else's application and touches nothing", async () => {
    const owner = await makeUser("sahip")
    const other = await makeUser("baskasi")
    const app = await makeApplication(owner.id)
    await expect(deleteApplication(prisma, other.id, app.analysis.id)).rejects.toBeInstanceOf(ApplicationNotFoundError)
    expect(await prisma.analysis.findUnique({ where: { id: app.analysis.id } })).not.toBeNull()
  })
})
