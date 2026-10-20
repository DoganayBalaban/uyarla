import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"
import { linkedinReport, type ScoredPosting } from "./report.js"

const profile = (over: Partial<ResumeProfile> = {}): ResumeProfile => ({
  fullName: "Elif",
  headline: "Frontend Geliştirici | React, TypeScript",
  summary: "React ve TypeScript ile ".repeat(12),
  experience: [{ company: "Acme", title: "Frontend Geliştirici", startDate: "2022", endDate: "halen", bullets: [] }],
  education: [],
  skills: ["React", "TypeScript", "CSS", "Git", "Jest"],
  languages: [],
  certifications: [],
  ...over,
})
const req = (text: string, missing: string[], importance = "must", type = "technical") => ({
  requirement: { text, type, importance, concepts: [] },
  status: missing.length ? "missing" : "matched",
  confidence: 0,
  evidence: null,
  method: null,
  matchedConcepts: [],
  missingConcepts: missing,
})
const scored = (id: string, reqs: ReturnType<typeof req>[], position = "Frontend Geliştirici"): ScoredPosting => ({
  analysisId: id,
  position,
  company: null,
  result: { score: 40, requirements: reqs, missingKeywords: [] } as unknown as ScoreResult,
})

describe("linkedinReport (DOG-69)", () => {
  it("lists concepts missing in at least two postings, musts first, once per posting", () => {
    const r = linkedinReport(profile(), [
      scored("a", [req("Next.js", ["Next.js"], "nice"), req("Docker", ["Docker"]), req("Docker 2", ["docker"])]),
      scored("b", [req("Next.js", ["Next.js"]), req("Docker", ["Docker"])]),
      scored("c", [req("GraphQL", ["GraphQL"]), req("İletişim", ["iletişim"], "must", "soft")]),
    ])
    expect(r.commonMissing).toEqual([
      { term: "Docker", postings: 2, must: true },
      { term: "Next.js", postings: 2, must: true },
    ])
  })

  it("with a single posting, its own gaps count", () => {
    expect(linkedinReport(profile(), [scored("a", [req("GraphQL", ["GraphQL"])])]).commonMissing.map((m) => m.term)).toEqual(["GraphQL"])
  })

  it("checks the headline against the target role and for being just a title", () => {
    const ok = linkedinReport(profile(), [scored("a", [])], { targetRole: "Frontend Geliştirici" })
    expect(ok.checks.find((c) => c.id === "headline_target")?.status).toBe("ok")
    expect(ok.checks.find((c) => c.id === "headline_generic")?.status).toBe("ok")
    const generic = linkedinReport(profile({ headline: "Frontend Geliştirici" }), [scored("a", [], "Kıdemli Frontend Mühendisi")])
    expect(generic.checks.find((c) => c.id === "headline_target")?.status).toBe("warn")
    expect(generic.checks.find((c) => c.id === "headline_generic")?.status).toBe("warn")
  })

  it("splits slash-separated titles and accepts any chosen posting's title", () => {
    // Tek parça aranınca "Yapay Zeka Mühendisi / Yapay Zeka Geliştiricisi" hiçbir başlıkta geçmiyordu.
    const slash = linkedinReport(profile({ headline: "AI Engineer | RAG, LLM" }), [scored("a", [], "Yapay Zeka Mühendisi / Yapay Zeka Geliştiricisi")])
    expect(slash.checks.find((c) => c.id === "headline_target")?.status).toBe("ok")
    const second = linkedinReport(profile({ headline: "Veri Analisti | SQL, Python" }), [scored("a", [], "Muhasebe Uzmanı"), scored("b", [], "Veri Analisti")])
    expect(second.checks.find((c) => c.id === "headline_target")).toMatchObject({ status: "ok", text: "Başlığında hedef unvan (“Veri Analisti”) geçiyor." })
  })

  it("flags an empty headline, a short or missing About and few skills", () => {
    const r = linkedinReport(profile({ headline: null, summary: "Kısa bir özet.", skills: ["React"] }), [scored("a", [])])
    expect(r.checks.map((c) => [c.id, c.status])).toEqual([
      ["headline_empty", "warn"],
      ["about_short", "warn"],
      ["skills_few", "warn"],
    ])
    expect(linkedinReport(profile({ summary: null }), [scored("a", [])]).checks.some((c) => c.id === "about_missing")).toBe(true)
  })
})
