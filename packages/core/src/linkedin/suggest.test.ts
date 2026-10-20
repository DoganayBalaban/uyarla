import { describe, expect, it, vi } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"
import type { ScoredPosting } from "./report.js"
import { headlineTitles, linkedinStrengths, suggestLinkedInText } from "./suggest.js"

const profile: ResumeProfile = {
  fullName: "Elif",
  headline: "Frontend Geliştirici",
  summary: "React ve TypeScript ile çalışıyorum.",
  experience: [{ company: "Acme", title: "Frontend Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "React ile panel geliştirdim", sourceRef: "React ile panel geliştirdim" }] }],
  education: [],
  skills: ["React", "TypeScript", "Git"],
  languages: ["İngilizce"],
  certifications: [],
}
const req = (type: string, matched: string[], importance = "must") => ({
  requirement: { text: "x", type, importance, concepts: [] },
  status: "matched",
  matchedConcepts: matched,
  missingConcepts: [],
})
const scored = (id: string, reqs: ReturnType<typeof req>[]): ScoredPosting => ({
  analysisId: id,
  position: "Frontend Geliştirici",
  company: null,
  result: { score: 50, requirements: reqs, missingKeywords: [] } as unknown as ScoreResult,
})
const posting = { position: "Frontend Geliştirici", company: "Beta", seniority: null, language: "tr", requirements: [] } as never

describe("LinkedIn suggestions (DOG-69)", () => {
  it("strengths are skills written in the profile, most common first; education, language and conditions left out", () => {
    const s = linkedinStrengths(
      [
        scored("a", [req("skill", ["React", "Git / TypeScript"]), req("education", ["Üniversite"]), req("skill", ["İngilizce bilen"])]),
        scored("b", [req("skill", ["TypeScript"]), req("condition", ["Ehliyet"])]),
      ],
      profile,
    )
    expect(s).toEqual(["TypeScript", "React", "Git"])
  })

  it("titles come from the profile; the target joins only if the profile already says it", () => {
    expect(headlineTitles(profile, "Frontend Geliştirici")).toEqual(["Frontend Geliştirici"])
    expect(headlineTitles(profile, "Kıdemli Backend Mühendisi")).toEqual(["Frontend Geliştirici"])
  })

  it("drops an invented 'seeking' line when no target was given, keeps it when it was", async () => {
    const llm = { extract: vi.fn(async () => ({ data: { baslik: "Frontend Geliştirici | React", hakkinda: "React ile panel geliştirdim. Frontend rolleri arıyorum." }, tokens: 1 })) }
    const without = await suggestLinkedInText(llm as never, { profile, scored: [scored("a", [])], postings: [posting] })
    expect(without.data.about.text).toBe("React ile panel geliştirdim.")
    const withTarget = await suggestLinkedInText(llm as never, { profile, scored: [scored("a", [])], postings: [posting], targetRole: "Frontend" })
    expect(withTarget.data.about.text).toContain("arıyorum")
  })

  it("cuts an over-long headline at the last separator and flags made-up numbers", async () => {
    const long = `Frontend Geliştirici | ${Array.from({ length: 30 }, (_, i) => `Beceri${i}`).join(", ")}`
    const llm = { extract: vi.fn(async () => ({ data: { baslik: long, hakkinda: "Sayfayı %70 hızlandırdım." }, tokens: 1 })) }
    const { data } = await suggestLinkedInText(llm as never, { profile, scored: [scored("a", [])], postings: [posting] })
    expect(data.headline.text.length).toBeLessThanOrEqual(120)
    expect(data.headline.text.endsWith(",")).toBe(false)
    expect(data.about.verification.status).toBe("flagged")
  })
})
