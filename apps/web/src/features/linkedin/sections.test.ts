import { describe, expect, it } from "vitest"
import { SECTION_LABELS, STATUS_LABELS, initials, sectionDelta } from "@/features/linkedin/sections"

describe("sections", () => {
  it("labels every section and status in Turkish", () => {
    expect(SECTION_LABELS.headline).toBe("Başlık")
    expect(SECTION_LABELS.postings).toBe("İlanlarına göre")
    expect(STATUS_LABELS.improve).toBe("Geliştirilebilir")
  })

  it("compares with the previous scan by section status", () => {
    const previous = { createdAt: "", summary: { passed: 5, total: 10 }, sections: [{ id: "headline" as const, status: "missing" as const }] }
    const report = { summary: { passed: 8, total: 10 }, sections: [{ id: "headline" as const, status: "strong" as const, checks: [] }] }
    expect(sectionDelta(previous, report as never)).toEqual({ passedDelta: 3, improved: ["headline"] })
    expect(sectionDelta(null, report as never)).toBeNull()
  })

  it("makes avatar initials", () => {
    expect(initials("Deniz Aksoy")).toBe("DA")
    expect(initials("ilkay")).toBe("İ")
    expect(initials(null)).toBe("?")
  })
})
