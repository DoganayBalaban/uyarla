import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { findPreviousAnalysis } from "@/server/duplicatePosting"

const toClean: string[] = []

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function setup() {
  const user = await prisma.user.create({ data: { name: "kopya", email: `kopya-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(user.id)
  const resume = await prisma.resume.create({ data: { userId: user.id, filePath: "x.pdf", rawText: "cv" } })
  const version = await prisma.resumeVersion.create({ data: { resumeId: resume.id, profile: {}, source: "parsed", versionNo: 1 } })
  const posting = await prisma.jobPosting.create({ data: { userId: user.id, rawText: "Muhasebe Uzmanı ilanı", requirements: [], language: "tr" } })
  const analysis = await prisma.analysis.create({
    data: { userId: user.id, jobPostingId: posting.id, resumeVersionId: version.id, modelId: "test", status: "done", score: 40 },
  })
  return { user, resume, analysis }
}

describe("findPreviousAnalysis · real database (DOG-98)", () => {
  it("finds a finished analysis of the same posting text", async () => {
    const { user, analysis } = await setup()
    expect((await findPreviousAnalysis(prisma, { userId: user.id, jobText: "Muhasebe Uzmanı ilanı", resumeId: null }))?.id).toBe(analysis.id)
    expect(await findPreviousAnalysis(prisma, { userId: user.id, jobText: "Başka bir ilan", resumeId: null })).toBeNull()
  })

  it("with a library resume, only matches analyses of that resume", async () => {
    const { user, resume, analysis } = await setup()
    expect((await findPreviousAnalysis(prisma, { userId: user.id, jobText: "Muhasebe Uzmanı ilanı", resumeId: resume.id }))?.id).toBe(analysis.id)
    expect(await findPreviousAnalysis(prisma, { userId: user.id, jobText: "Muhasebe Uzmanı ilanı", resumeId: "baska-cv" })).toBeNull()
  })
})
