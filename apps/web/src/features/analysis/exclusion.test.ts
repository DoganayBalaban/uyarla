import { describe, expect, it } from "vitest"
import { applyExclusions } from "@/features/analysis/exclusion"

const req = (text: string, status: "matched" | "missing", missingConcepts: string[] = []) => ({
  requirement: { text, importance: "must", type: "skill" },
  status,
  confidence: status === "matched" ? 1 : 0,
  method: status === "matched" ? "keyword" : null,
  evidence: null,
  missingConcepts,
})

const base = {
  score: 33,
  requirements: [req("Excel", "matched"), req("İş hukuku", "missing", ["İş hukuku"]), req("SGK ve iş hukuku", "missing", ["SGK", "İş hukuku"])],
  missingKeywords: ["İş hukuku", "SGK"],
}

describe("applyExclusions", () => {
  it("changes nothing when nothing is marked", () => {
    const v = applyExclusions(base)
    expect(v.score).toBe(33)
    expect(v.active).toHaveLength(3)
    expect(v.missingKeywords).toEqual(["İş hukuku", "SGK"])
    expect(v.excludedCount).toBe(0)
  })

  it("uses the server's adjusted score and leaves marked requirements out of counts", () => {
    const v = applyExclusions({ ...base, excluded: [2], adjustedScore: 50 })
    expect(v.score).toBe(50)
    expect(v.active.map((r) => r.requirement.text)).toEqual(["Excel", "İş hukuku"])
    expect(v.rows[2]).toMatchObject({ index: 2, excluded: true })
  })

  it("drops a missing concept only when no unmarked requirement still misses it", () => {
    expect(applyExclusions({ ...base, excluded: [2], adjustedScore: 50 }).missingKeywords).toEqual(["İş hukuku"])
    expect(applyExclusions({ ...base, excluded: [1, 2], adjustedScore: 100 }).missingKeywords).toEqual([])
  })

  it("falls back to the original score if an older record has marks but no adjusted score", () => {
    expect(applyExclusions({ ...base, excluded: [1] }).score).toBe(33)
  })
})
