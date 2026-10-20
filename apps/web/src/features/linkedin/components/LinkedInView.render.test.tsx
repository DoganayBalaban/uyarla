import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ReportView } from "@/features/linkedin/components/LinkedInView"
import { linkedinReportRequestSchema } from "@/features/resumes/schema"

describe("LinkedIn report (DOG-69)", () => {
  it("shows checks and the common gaps with the honesty note", () => {
    const html = renderToStaticMarkup(
      <ReportView
        report={{
          postings: [
            { analysisId: "a", position: "Frontend", company: "Beta", score: 40 },
            { analysisId: "b", position: "Frontend", company: null, score: 50 },
          ],
          commonMissing: [{ term: "Docker", postings: 2, must: true }],
          checks: [{ id: "headline_generic", status: "warn", text: "Başlığın yalnızca unvan" }],
          headline: "Frontend Geliştirici",
          about: null,
        }}
      />,
    )
    expect(html).toContain("Başlığın yalnızca unvan")
    expect(html).toContain("Docker")
    expect(html).toContain("2 ilanda")
    expect(html).toContain("yoksa ekleme")
  })

  it("shows the headline and About suggestions with counts and flags", () => {
    const html = renderToStaticMarkup(
      <ReportView
        report={{
          postings: [{ analysisId: "a", position: "Frontend", company: null, score: 40 }],
          commonMissing: [],
          checks: [],
          headline: "Frontend Geliştirici",
          about: null,
          suggestions: {
            headline: { text: "Frontend Geliştirici | React, TypeScript", verification: { status: "ok", issues: [] } },
            about: { text: "React ile panel geliştirdim.", verification: { status: "flagged", issues: [{ kind: "number_mismatch", detail: "\"70\" CV'nde yok." }] } },
          },
        }}
      />,
    )
    expect(html).toContain("Öneriler")
    expect(html).toContain("Frontend Geliştirici | React, TypeScript")
    expect(html).toContain("40/120 karakter")
    expect(html).toContain("Kontrol et")
    expect(html).toContain("Şu anki: Frontend Geliştirici")
  })

  it("accepts one to three distinct postings", () => {
    expect(linkedinReportRequestSchema.safeParse({ type: "linkedin-report", analysisIds: ["a"] }).success).toBe(true)
    expect(linkedinReportRequestSchema.safeParse({ type: "linkedin-report", analysisIds: [] }).success).toBe(false)
    expect(linkedinReportRequestSchema.safeParse({ type: "linkedin-report", analysisIds: ["a", "b", "c", "d"] }).success).toBe(false)
    expect(linkedinReportRequestSchema.safeParse({ type: "linkedin-report", analysisIds: ["a", "a"] }).success).toBe(false)
  })
})
