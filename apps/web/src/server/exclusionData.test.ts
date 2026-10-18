import { describe, expect, it } from "vitest"
import { backfillScore, exclusionRecords } from "@/server/exclusionData"

const req = (text: string, confidence: number) => ({
  requirement: { text, type: "skill", importance: "must", concepts: [{ term: text, synonyms: [] }] },
  confidence,
})

describe("exclusionRecords (DOG-90)", () => {
  const analysis = {
    id: "a1",
    createdAt: new Date("2026-10-18T10:00:00Z"),
    result: {
      requirements: [req("React", 1), req("Kubernetes", 0), req("Jest", 0)],
      excluded: [1, 2],
      exclusions: {
        1: { reason: "not_in_posting", scope: "always" },
        2: { reason: "irrelevant", scope: "profile" },
      },
      reports: [{ index: 0, reason: "found_in_cv", at: "2026-10-18T11:00:00.000Z" }],
    },
    jobPosting: { position: "Frontend", language: "tr", rawText: "ilan metni" },
  }

  it("lists the user's own marks and reports with the posting, never the CV", () => {
    const records = exclusionRecords(analysis)
    expect(records.map((r) => [r.requirement.text, r.reason, r.scope])).toEqual([
      ["Kubernetes", "not_in_posting", "always"],
      ["React", "found_in_cv", "report"],
    ])
    expect(records[0]).toMatchObject({ analysisId: "a1", position: "Frontend", postingText: "ilan metni" })
    expect(JSON.stringify(records)).not.toMatch(/evidence|profile/)
  })

  it("treats marks from before reasons existed as 'not in posting'", () => {
    const old = { ...analysis, result: { requirements: analysis.result.requirements, excluded: [1] } }
    expect(exclusionRecords(old).map((r) => r.reason)).toEqual(["not_in_posting"])
  })

  it("is empty for an analysis without marks", () => {
    expect(exclusionRecords({ ...analysis, result: { requirements: [] } })).toEqual([])
    expect(exclusionRecords({ ...analysis, result: null })).toEqual([])
  })
})

describe("backfillScore (DOG-90)", () => {
  const result = { score: 33, requirements: [req("a", 1), req("b", 0), req("c", 0)], scoringRevision: 2, excluded: [2] }

  it("returns the adjusted score for a marked analysis still showing the first score", () => {
    expect(backfillScore({ score: 33, result })).toBe(50)
  })

  it("leaves analyses that are already right or unmarked alone", () => {
    expect(backfillScore({ score: 50, result })).toBeNull()
    expect(backfillScore({ score: 33, result: { ...result, excluded: [] } })).toBeNull()
    expect(backfillScore({ score: null, result })).toBeNull()
    expect(backfillScore({ score: 33, result: null })).toBeNull()
  })
})
