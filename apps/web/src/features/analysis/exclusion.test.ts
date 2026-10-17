import { describe, expect, it } from "vitest"
import { weightedScore } from "@uyarla/core"
import { adjustedScore, applyExclusions } from "@/features/analysis/exclusion"

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

  it("recomputes the score without marked requirements and leaves them out of counts", () => {
    const v = applyExclusions({ ...base, excluded: [2] })
    expect(v.score).toBe(50)
    expect(v.active.map((r) => r.requirement.text)).toEqual(["Excel", "İş hukuku"])
    expect(v.rows[2]).toMatchObject({ index: 2, excluded: true })
  })

  it("drops a missing concept only when no unmarked requirement still misses it", () => {
    expect(applyExclusions({ ...base, excluded: [2] }).missingKeywords).toEqual(["İş hukuku"])
    expect(applyExclusions({ ...base, excluded: [1, 2] }).missingKeywords).toEqual([])
  })

})

describe("adjustedScore", () => {
  // Eşlik testi: web'deki kopya core'daki weightedScore'la aynı sonucu
  // vermeli. Ağırlıklar ya da formül değişirse burası kırılır.
  it("matches core weightedScore on mixed must/nice requirements", () => {
    const mk = (importance: "must" | "nice", confidence: number) => ({
      requirement: { text: "x", type: "skill" as const, importance, concepts: [] },
      confidence,
    })
    const reqs = [mk("must", 1), mk("must", 0.25), mk("nice", 0.6), mk("nice", 0), mk("must", 0.5)]
    for (const excluded of [[], [0], [1, 3], [0, 1, 2, 3, 4]]) {
      expect(adjustedScore(reqs, excluded)).toBe(weightedScore(reqs, undefined, excluded))
    }
  })
})
