import { describe, expect, it } from "vitest"
import { MIN_JOB_TEXT_LENGTH } from "@/features/analysis/schema"
import { SAMPLE_POSTINGS, isSamplePosting } from "@/features/analysis/samplePostings"

describe("sample postings (DOG-101)", () => {
  it("are long enough to analyse and say they are samples", () => {
    for (const s of SAMPLE_POSTINGS) {
      expect(s.text.trim().length).toBeGreaterThan(MIN_JOB_TEXT_LENGTH)
      expect(s.text.split("\n")[0]).toContain("(örnek ilan)")
    }
  })

  it("recognises an unedited sample regardless of whitespace, but not an edited one", () => {
    const text = SAMPLE_POSTINGS[0]!.text
    expect(isSamplePosting(`  ${text.replace(/\n/g, "\r\n")}  `)).toBe(true)
    expect(isSamplePosting(text.replace("React", "Vue"))).toBe(false)
    expect(isSamplePosting("Başka bir ilan")).toBe(false)
  })
})
