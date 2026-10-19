import { describe, expect, it } from "vitest"
import { weightedScore } from "@uyarla/core/score/score"
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

  it("matches core with soft requirements and every title level (DOG-103)", () => {
    const mk = (type: "skill" | "soft" | "experience", importance: "must" | "nice", confidence: number) => ({
      requirement: { text: "x", type, importance, concepts: [] },
      confidence,
    })
    const reqs = [mk("skill", "must", 1), mk("soft", "must", 0), mk("experience", "nice", 0.5), mk("soft", "nice", 1)]
    const onlySoft = [mk("soft", "must", 1), mk("soft", "nice", 0)]
    for (const list of [reqs, onlySoft]) {
      for (const title of [null, { level: "exact" as const }, { level: "partial" as const }, { level: "none" as const }]) {
        for (const excluded of [[], [0], [0, 2]]) {
          expect(adjustedScore(list, excluded, { title, revision: 2 })).toBe(weightedScore(list, undefined, excluded, title))
        }
      }
    }
  })

  it("keeps the old formula for analyses saved before the change", () => {
    const mk = (type: "skill" | "soft", confidence: number) => ({
      requirement: { text: "x", type, importance: "must", concepts: [] },
      confidence,
    })
    // Eski formül soft dahil, unvansız: 0 ve 1 → 50. Yenisi soft'u ve unvanı
    // ayırırdı: (0 + 0) / (2 + 2) → 0.
    const reqs = [mk("skill", 0), mk("soft", 1)]
    expect(adjustedScore(reqs, [], { title: { level: "none" } })).toBe(50)
    expect(adjustedScore(reqs, [], { title: { level: "none" }, revision: 2 })).toBe(0)
  })
})

describe("applyExclusions · soft requirements (DOG-103)", () => {
  const soft = (text: string, status: "matched" | "missing", missingConcepts: string[] = []) => ({
    ...req(text, status, missingConcepts),
    requirement: { text, importance: "must", type: "soft" },
  })
  const result = {
    score: 50,
    requirements: [req("Excel", "matched"), soft("Takım çalışması", "missing", ["takım çalışması"]), req("İş hukuku", "missing", ["İş hukuku"])],
    missingKeywords: ["takım çalışması", "İş hukuku"],
    scoringRevision: 2,
  }

  it("lists soft requirements apart and leaves them out of counts and missing concepts", () => {
    const v = applyExclusions(result)
    expect(v.rows.map((r) => r.item.requirement.text)).toEqual(["Excel", "İş hukuku"])
    expect(v.softRows).toEqual([{ item: result.requirements[1], index: 1 }])
    expect(v.active).toHaveLength(2)
    expect(v.missingKeywords).toEqual(["İş hukuku"])
  })

  it("keeps old analyses as they were: soft counted in the list", () => {
    const v = applyExclusions({ ...result, scoringRevision: undefined })
    expect(v.rows).toHaveLength(3)
    expect(v.softRows).toEqual([])
    expect(v.missingKeywords).toEqual(["takım çalışması", "İş hukuku"])
  })

  it("keeps soft requirements in the list when the posting has nothing else", () => {
    const v = applyExclusions({ ...result, requirements: [soft("İletişim", "missing")] })
    expect(v.rows).toHaveLength(1)
    expect(v.softRows).toEqual([])
  })
})

describe("applyExclusions · conditions (DOG-115)", () => {
  const condition = (text: string, status: "matched" | "missing") => ({
    ...req(text, status),
    requirement: { text, importance: "must", type: "condition" },
  })

  it("lists conditions apart, never in rows or counts, even when nothing else is there", () => {
    const result = {
      score: 100,
      requirements: [req("Excel", "matched"), condition("Ankara'da ikamet", "missing")],
      missingKeywords: [],
      scoringRevision: 2,
    }
    const v = applyExclusions(result)
    expect(v.rows.map((r) => r.item.requirement.text)).toEqual(["Excel"])
    expect(v.conditionRows).toEqual([{ item: result.requirements[1], index: 1 }])
    expect(v.active).toHaveLength(1)
    expect(applyExclusions({ ...result, requirements: [condition("Ehliyet", "missing")] }).rows).toEqual([])
  })
})

describe("applyExclusions · corrections (DOG-90)", () => {
  it("recomputes the score after a correction even with nothing marked", () => {
    const req = (confidence: number) => ({
      requirement: { text: "x", importance: "must", type: "skill" }, status: "matched" as const, confidence, method: null, evidence: null,
    })
    const view = applyExclusions({ score: 10, requirements: [req(1), req(1)], missingKeywords: [], scoringRevision: 2, corrections: { 0: { minYears: 1 } } })
    expect(view.score).toBe(100)
  })
})
