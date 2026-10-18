import { describe, expect, it } from "vitest"
import { scoreWithExclusions, setRequirementExcluded } from "@/server/requirementExclusion"

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

  it("is the adjusted score the dashboard and board show", () => {
    expect(scoreWithExclusions(result, [2])).toBe(50)
    // Unvan da sonucun formülüyle katılıyor (DOG-103).
    expect(scoreWithExclusions({ ...result, titleMatch: { level: "none" } }, [2])).toBe(33)
  })
})
