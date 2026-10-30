import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { rememberAdapted } from "@/server/adaptedScore"

const toClean: string[] = []
afterEach(async () => {
  await prisma.analysis.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: toClean } } })
  await prisma.user.deleteMany({ where: { id: { in: toClean } } })
  toClean.length = 0
})

async function makeAnalysis(result: object) {
  const u = await prisma.user.create({ data: { name: "u", email: `uyarlanan-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  const posting = await prisma.jobPosting.create({ data: { userId: u.id, rawText: "ilan", requirements: [], language: "tr" } })
  return prisma.analysis.create({ data: { userId: u.id, jobPostingId: posting.id, modelId: "t", status: "done", score: 58, result } })
}

describe("rememberAdapted (DOG-166)", () => {
  it("writes the adapted summary next to the analysis without touching the rest", async () => {
    const a = await makeAnalysis({ score: 58, excluded: [2], requirements: [] })
    await rememberAdapted(a.id, a.result, { score: 75, statuses: [], titleLevel: "partial" })
    const after = (await prisma.analysis.findUnique({ where: { id: a.id } }))!
    expect(after.result).toEqual({ score: 58, excluded: [2], requirements: [], adapted: { score: 75, statuses: [], titleLevel: "partial" } })
    expect(after.score).toBe(58)
  })

  it("skips the write when nothing changed", async () => {
    const summary = { score: 75, statuses: ["matched"], titleLevel: null }
    const a = await makeAnalysis({ adapted: summary })
    expect(await rememberAdapted(a.id, a.result, summary)).toBe(false)
    expect(await rememberAdapted(a.id, a.result, { ...summary, score: 80 })).toBe(true)
  })
})
