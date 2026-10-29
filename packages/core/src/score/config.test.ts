import { describe, expect, it } from "vitest"
import { DEFAULT_SCORING_CONFIG, SCORING_REVISION, scoringConfigFor } from "./config.js"

describe("scoringConfigFor", () => {
  it("gives the current formula for the current revision", () => {
    expect(scoringConfigFor(SCORING_REVISION)).toBe(DEFAULT_SCORING_CONFIG)
  })

  it("keeps revision 1 as it was: soft in the score, no title", () => {
    const v1 = scoringConfigFor(1)
    expect(v1.unscoredTypes).toEqual([])
    expect(v1.titleWeight).toBe(0)
    expect(scoringConfigFor(undefined)).toEqual(v1)
  })

  it("keeps revision 2 as it was: soft and conditions out, title in, semantic at similarity", () => {
    const v2 = scoringConfigFor(2)
    expect(v2.unscoredTypes).toEqual(["soft", "condition"])
    expect(v2.titleWeight).toBe(2)
    expect(v2.semanticCredit).toBe("similarity")
  })

  it("treats an unknown future revision as the current one", () => {
    expect(scoringConfigFor(SCORING_REVISION + 1)).toBe(DEFAULT_SCORING_CONFIG)
  })
})
