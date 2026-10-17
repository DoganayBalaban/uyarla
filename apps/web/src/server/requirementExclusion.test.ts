import { describe, expect, it } from "vitest"
import { setRequirementExcluded } from "@/server/requirementExclusion"

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
