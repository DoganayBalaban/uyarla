import { describe, expect, it } from "vitest"
import {
  markRequirement,
  mergeCorrection,
  parseAnalysisPatch,
  scoreWithExclusions,
  setRequirementExcluded,
  unmarkRequirement,
} from "@/server/requirementExclusion"

const result = { requirements: [{}, {}, {}] }

describe("setRequirementExcluded", () => {
  it("adds and removes an index, keeping the list sorted and unique", () => {
    expect(setRequirementExcluded({ ...result, excluded: [2] }, 0, true)).toEqual([0, 2])
    expect(setRequirementExcluded({ ...result, excluded: [0, 2] }, 0, true)).toEqual([0, 2])
    expect(setRequirementExcluded({ ...result, excluded: [0, 2] }, 2, false)).toEqual([0])
  })

  it("works on results saved before the field existed", () => {
    expect(setRequirementExcluded(result, 1, true)).toEqual([1])
  })

  it("rejects an index outside the requirement list", () => {
    expect(() => setRequirementExcluded(result, 3, true)).toThrow(RangeError)
    expect(() => setRequirementExcluded(result, -1, true)).toThrow(RangeError)
    expect(() => setRequirementExcluded(result, 1.5, true)).toThrow(RangeError)
  })
})

describe("scoreWithExclusions (DOG-90, ikinci adım)", () => {
  const req = (type: string, confidence: number) => ({ requirement: { text: "x", importance: "must", type }, confidence })
  const result = { score: 33, requirements: [req("skill", 1), req("skill", 0), req("skill", 0)], scoringRevision: 2 }

  it("keeps the first score when nothing is marked", () => {
    expect(scoreWithExclusions(result, [])).toBe(33)
  })

  it("recomputes once declarations exist, even after the last one is undone", () => {
    // Yeniden hesap güncel formülle; ilk skora dönmek parçalarla çelişirdi.
    expect(scoreWithExclusions({ ...result, declarations: [] }, [])).toBe(33)
    expect(scoreWithExclusions({ ...result, score: 40, declarations: [] }, [])).toBe(33)
    expect(scoreWithExclusions({ ...result, score: 40 }, [])).toBe(40)
  })

  it("is the adjusted score the dashboard and board show", () => {
    expect(scoreWithExclusions(result, [2])).toBe(50)
    // Unvan da sonucun formülüyle katılıyor (DOG-103).
    expect(scoreWithExclusions({ ...result, titleMatch: { level: "none" } }, [2])).toBe(33)
  })
})

describe("parseAnalysisPatch: beyan (K-114)", () => {
  const target = { section: "experience", index: 0 }

  it("accepts a declaration and trims it", () => {
    expect(parseAnalysisPatch({ action: "declare", requirementIndex: 1, declaration: { kind: "skill", terms: [" HTML "] } })).toEqual({
      action: "declare",
      requirementIndex: 1,
      declaration: { kind: "skill", terms: ["HTML"] },
    })
    expect(
      parseAnalysisPatch({ action: "declare", requirementIndex: 1, declaration: { kind: "experience", target, text: "  Paneli React ile yaptım " } }),
    ).toEqual({ action: "declare", requirementIndex: 1, declaration: { kind: "experience", target, text: "Paneli React ile yaptım" } })
    expect(
      parseAnalysisPatch({ action: "declare", requirementIndex: 1, declaration: { kind: "education", school: " Marmara ", field: "İşletme" } }),
    ).toEqual({ action: "declare", requirementIndex: 1, declaration: { kind: "education", school: "Marmara", field: "İşletme" } })
  })

  it("accepts an undo", () => {
    expect(parseAnalysisPatch({ action: "undeclare", requirementIndex: 2 })).toEqual({ action: "undeclare", requirementIndex: 2 })
  })

  it.each([
    [{ kind: "skill", terms: [] }],
    [{ kind: "skill", terms: Array(11).fill("a") }],
    [{ kind: "skill", terms: ["a".repeat(61)] }],
    [{ kind: "skill", terms: ["   "] }],
    [{ kind: "experience", target, text: "   kısa   " }],
    [{ kind: "experience", target, text: "a".repeat(201) }],
    [{ kind: "experience", target: { section: "other", index: 0 }, text: "Paneli React ile yaptım" }],
    [{ kind: "experience", target: { section: "experience", index: -1 }, text: "Paneli React ile yaptım" }],
    [{ kind: "education", school: "A", field: "İşletme" }],
    [{ kind: "education", school: "Marmara", field: "a".repeat(121) }],
    [{ kind: "other" }],
    [null],
  ])("rejects %j", (declaration) => {
    expect(parseAnalysisPatch({ action: "declare", requirementIndex: 0, declaration })).toBeNull()
  })
})

describe("parseAnalysisPatch (DOG-90)", () => {
  it("reads the new actions", () => {
    expect(parseAnalysisPatch({ action: "exclude", requirementIndex: 1, reason: "irrelevant", always: true })).toEqual({
      action: "exclude", requirementIndex: 1, reason: "irrelevant", always: true,
    })
    expect(parseAnalysisPatch({ action: "include", requirementIndex: 0 })).toEqual({ action: "include", requirementIndex: 0 })
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 2, minYears: 3 })).toEqual({
      action: "correct", requirementIndex: 2, minYears: 3,
    })
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 2, terms: ["a", " b "] })).toEqual({
      action: "correct", requirementIndex: 2, terms: ["a", "b"],
    })
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 2, minYears: null })).toEqual({
      action: "correct", requirementIndex: 2, minYears: null,
    })
  })

  it("keeps the old body working", () => {
    expect(parseAnalysisPatch({ requirementIndex: 1, excluded: true })).toEqual({
      action: "exclude", requirementIndex: 1, reason: "not_in_posting", always: false,
    })
    expect(parseAnalysisPatch({ requirementIndex: 1, excluded: false })).toEqual({ action: "include", requirementIndex: 1 })
  })

  it("rejects malformed bodies", () => {
    expect(parseAnalysisPatch({ action: "exclude", requirementIndex: 1, reason: "nope" })).toBeNull()
    expect(parseAnalysisPatch({ action: "exclude", requirementIndex: "1", reason: "irrelevant" })).toBeNull()
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 1, minYears: 0 })).toBeNull()
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 1, minYears: 41 })).toBeNull()
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 1 })).toBeNull()
    expect(parseAnalysisPatch({ action: "correct", requirementIndex: 1, terms: [] })).toBeNull()
    expect(parseAnalysisPatch(null)).toBeNull()
  })

  it("never lets a found-in-CV report become permanent", () => {
    expect(parseAnalysisPatch({ action: "exclude", requirementIndex: 0, reason: "found_in_cv", always: true })).toEqual({
      action: "exclude", requirementIndex: 0, reason: "found_in_cv", always: false,
    })
  })
})

describe("parseAnalysisPatch position (DOG-134)", () => {
  it("reads a title correction without a requirement index", () => {
    expect(parseAnalysisPatch({ action: "position", position: "  Dijital Pazarlama Uzmanı " })).toEqual({
      action: "position", position: "Dijital Pazarlama Uzmanı",
    })
    expect(parseAnalysisPatch({ action: "position", position: null })).toEqual({ action: "position", position: null })
  })

  it("rejects an empty, too long or non-string title", () => {
    expect(parseAnalysisPatch({ action: "position", position: "  " })).toBeNull()
    expect(parseAnalysisPatch({ action: "position", position: "x".repeat(121) })).toBeNull()
    expect(parseAnalysisPatch({ action: "position", position: 3 })).toBeNull()
    expect(parseAnalysisPatch({ action: "position" })).toBeNull()
  })
})

describe("markRequirement / unmarkRequirement (DOG-90)", () => {
  const concepts = [{ term: "Docker", synonyms: [] }, { term: "Kubernetes", synonyms: ["k8s"] }]
  const base = { requirements: [{ requirement: { concepts } }, { requirement: { concepts: [] } }] }
  const AT = "2026-10-18T12:00:00.000Z"

  it("excludes with a reason and scope, and returns the terms to remember", () => {
    const out = markRequirement(base, 0, { reason: "irrelevant", always: true }, AT)
    expect(out.result.excluded).toEqual([0])
    expect(out.result.exclusions).toEqual({ 0: { reason: "irrelevant", scope: "always" } })
    expect(out.remember).toEqual(["Docker", "Kubernetes"])
  })

  it("remembers nothing for a one-off mark", () => {
    const out = markRequirement(base, 0, { reason: "not_in_posting", always: false }, AT)
    expect(out.result.exclusions).toEqual({ 0: { reason: "not_in_posting", scope: "analysis" } })
    expect(out.remember).toEqual([])
  })

  it("records a found-in-CV report without excluding", () => {
    const out = markRequirement(base, 1, { reason: "found_in_cv", always: false }, AT)
    expect(out.result.excluded ?? []).toEqual([])
    expect(out.result.reports).toEqual([{ index: 1, reason: "found_in_cv", at: AT }])
    // Aynı bildirim iki kez yazılmıyor.
    const again = markRequirement(out.result, 1, { reason: "found_in_cv", always: false }, AT)
    expect(again.result.reports).toHaveLength(1)
  })

  it("unmarks: drops the index and its reason", () => {
    const marked = markRequirement(base, 0, { reason: "irrelevant", always: false }, AT).result
    const out = unmarkRequirement(marked, 0)
    expect(out.excluded).toEqual([])
    expect(out.exclusions).toEqual({})
  })

  it("rejects an unknown requirement", () => {
    expect(() => markRequirement(base, 5, { reason: "irrelevant", always: false }, AT)).toThrow(RangeError)
  })
})

describe("scoreWithExclusions · corrections (DOG-90)", () => {
  const req = (confidence: number) => ({ requirement: { text: "x", importance: "must", type: "skill" }, confidence })
  it("recomputes when the requirements were corrected even with nothing marked", () => {
    const corrected = { score: 0, requirements: [req(1), req(1)], scoringRevision: 2, corrections: { 0: { minYears: 1 } } }
    expect(scoreWithExclusions(corrected, [])).toBe(100)
  })
})

describe("mergeCorrection (DOG-90)", () => {
  it("adds, updates and removes a correction", () => {
    const one = mergeCorrection(undefined, 2, { minYears: 3 })
    expect(one).toEqual({ 2: { minYears: 3 } })
    expect(mergeCorrection(one, 2, { terms: ["a"] })).toEqual({ 2: { minYears: 3, terms: ["a"] } })
    expect(mergeCorrection(one, 2, { minYears: null })).toEqual({})
  })
})
