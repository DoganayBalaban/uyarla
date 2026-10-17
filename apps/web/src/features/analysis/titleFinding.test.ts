import { describe, expect, it } from "vitest"
import { withTitleFinding } from "@/features/analysis/titleFinding"

const format = { findings: [], passed: ["E-posta adresi"] }

describe("withTitleFinding", () => {
  it("adds a passed check when the posting title is on the resume", () => {
    const r = withTitleFinding(format, { position: "Muhasebe Uzmanı", level: "exact", resumeTitle: "Genel Muhasebe Uzmanı" })
    expect(r).toEqual({ findings: [], passed: ["E-posta adresi", "İlandaki unvan"] })
  })

  it("adds a content warning naming both titles when they are close", () => {
    const r = withTitleFinding(format, {
      position: "Digital Marketing Specialist",
      level: "partial",
      resumeTitle: "Performance Marketing Specialist",
    })
    expect(r!.findings).toHaveLength(1)
    expect(r!.findings[0]).toMatchObject({ code: "title_partial", group: "content", severity: "warning" })
    expect(r!.findings[0]!.description).toContain("Performance Marketing Specialist")
  })

  it("adds a content warning when the title is missing", () => {
    const r = withTitleFinding(format, { position: "Satış Danışmanı", level: "none", resumeTitle: null })
    expect(r!.findings[0]).toMatchObject({ code: "title_missing", group: "content" })
  })

  it("leaves old analyses untouched and opens no card without a format report", () => {
    expect(withTitleFinding(format, undefined)).toBe(format)
    expect(withTitleFinding(null, { position: "X", level: "none", resumeTitle: null })).toBeNull()
  })
})
