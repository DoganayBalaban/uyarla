import { describe, expect, it } from "vitest"
import type { AdaptationDraft, Contribution } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"
import { analysisProfile, factsFromAdaptations, markFactEvidence, withFacts, type RememberedFact } from "./facts.js"

const profile: ResumeProfile = {
  fullName: null,
  headline: null,
  summary: null,
  experience: [
    { company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "React ile panel yaptım", sourceRef: "r" }] },
    { company: "Acme", title: "Stajyer", startDate: "2021", endDate: "2022", bullets: [] },
    { company: "Beta", title: "Stajyer", startDate: "2020", endDate: "2021", bullets: [] },
  ],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
}

const contribution = (over: Partial<Contribution> = {}): Contribution => ({
  id: "c-1",
  requirementIndex: 0,
  experienceIndex: 1,
  answer: "docker compose ile kurdum",
  status: "done",
  text: "Uygulamayı Docker Compose ile kurdum.",
  decision: "accepted",
  ...over,
})

const draft = (contributions: Contribution[]): AdaptationDraft => ({
  summary: { original: null, rewritten: "", verification: { status: "ok", issues: [] }, decision: "accepted" },
  bullets: [],
  skillOrder: [],
  contributions,
})

const source = (contributions: Contribution[], over: { id?: string; at?: string } = {}) => ({
  adaptationId: over.id ?? "ad-1",
  createdAt: new Date(over.at ?? "2026-10-01"),
  draft: draft(contributions),
  profile,
  requirements: [{ text: "Docker deneyimi", importance: "must" as const, type: "skill" as const, concepts: [] }],
})

const fact = (over: Partial<RememberedFact> = {}): RememberedFact => ({
  id: "ad-1:c-1",
  company: "Acme",
  title: "Stajyer",
  text: "Uygulamayı Docker Compose ile kurdum.",
  answer: "docker compose ile kurdum",
  requirement: "Docker deneyimi",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...over,
})

describe("factsFromAdaptations", () => {
  it("takes accepted contributions with their job and requirement", () => {
    expect(factsFromAdaptations([source([contribution()])])).toEqual([fact()])
  })

  it("skips pending, rejected, empty, running and forgotten contributions", () => {
    const facts = factsFromAdaptations([
      source([
        contribution({ id: "a", decision: "pending" }),
        contribution({ id: "b", decision: "rejected" }),
        contribution({ id: "c", text: "" }),
        contribution({ id: "d", status: "running" }),
        contribution({ id: "e", forgotten: true }),
      ]),
    ])
    expect(facts).toEqual([])
  })

  it("keeps the newest copy of the same bullet and skips unparsable drafts", () => {
    const facts = factsFromAdaptations([
      source([contribution()], { id: "old", at: "2026-09-01" }),
      source([contribution()], { id: "new", at: "2026-10-01" }),
      { ...source([]), adaptationId: "broken", draft: {} },
    ])
    expect(facts.map((f) => f.id)).toEqual(["new:c-1"])
  })
})

describe("withFacts", () => {
  it("appends the fact to the job with the same company and title, answer as sourceRef", () => {
    const { profile: merged, applied } = withFacts(profile, [fact()])
    expect(merged.experience[1]!.bullets).toEqual([{ text: fact().text, sourceRef: fact().answer }])
    // Var olan madde kimlikleri kaymıyor.
    expect(merged.experience[0]!.bullets).toEqual(profile.experience[0]!.bullets)
    expect(applied).toEqual([fact()])
  })

  it("falls back to the company when the title changed, and skips unknown companies", () => {
    expect(withFacts(profile, [fact({ title: "Kıdemli" })]).profile.experience[0]!.bullets).toHaveLength(2)
    expect(withFacts(profile, [fact({ company: "Gama" })])).toEqual({ profile, applied: [] })
  })

  it("does not add a bullet the CV already has", () => {
    const reuploaded = withFacts(profile, [fact()]).profile
    expect(withFacts(reuploaded, [fact()]).applied).toEqual([])
  })
})

describe("analysisProfile", () => {
  it("rebuilds the profile from the facts on the result, and ignores bad data", () => {
    expect(analysisProfile(profile, { facts: [fact()] })).toEqual(withFacts(profile, [fact()]).profile)
    expect(analysisProfile(profile, { facts: [{ id: 1 }] })).toBe(profile)
    expect(analysisProfile(profile, null)).toBe(profile)
  })
})

describe("markFactEvidence", () => {
  it("marks evidence that came from a fact and records the facts", () => {
    const result = {
      score: 50,
      missingKeywords: [],
      requirements: [
        { evidence: { text: "x", matchText: "x", kind: "bullet", sourceRef: fact().answer } },
        { evidence: { text: "y", matchText: "y", kind: "bullet", sourceRef: "r" } },
      ],
    } as unknown as ScoreResult
    const marked = markFactEvidence(result, [fact()])
    expect(marked.requirements[0]!.evidence!.fact).toBe(true)
    expect(marked.requirements[1]!.evidence!.fact).toBeUndefined()
    expect(marked.facts).toEqual([fact()])
    expect(markFactEvidence(result, [])).toBe(result)
  })
})
