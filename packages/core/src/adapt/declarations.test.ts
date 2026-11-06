import { describe, expect, it } from "vitest"
import { toDocumentModel } from "../document/model.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { scoreProfile } from "../score/live.js"
import type { ScoreResult } from "../score/score.js"
import { analysisProfile } from "./facts.js"
import {
  declareTargets,
  markDeclarationEvidence,
  removeDeclaration,
  upsertDeclaration,
  withDeclarations,
  type Declaration,
} from "./declarations.js"

const at = "2026-11-06T00:00:00.000Z"
const skill = (requirementIndex: number, terms: string[]): Declaration => ({ requirementIndex, kind: "skill", terms, at })
const experience = (requirementIndex: number, target: { section: "experience" | "projects"; index: number }, text: string): Declaration => ({
  requirementIndex,
  kind: "experience",
  target,
  text,
  at,
})
const education = (requirementIndex: number, school: string, field: string): Declaration => ({ requirementIndex, kind: "education", school, field, at })

const profile: ResumeProfile = {
  fullName: null,
  headline: null,
  summary: null,
  experience: [{ company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "React ile panel yaptım", sourceRef: "r" }] }],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
  projects: [{ name: "Bitirme", role: null, startDate: null, endDate: null, bullets: [] }],
} as ResumeProfile

describe("withDeclarations", () => {
  it("returns the same profile when nothing is declared", () => {
    expect(withDeclarations(profile, [])).toBe(profile)
  })

  it("adds a skill once, ignoring case and Turkish spelling", () => {
    const out = withDeclarations({ ...profile, skills: ["html"] }, [skill(0, ["HTML", "CSS"])])
    expect(out.skills).toEqual(["html", "CSS"])
  })

  it("appends the sentence to the chosen job, keeping existing bullets", () => {
    const text = "Müşteri panelini React ile geliştirdim"
    const out = withDeclarations(profile, [experience(1, { section: "experience", index: 0 }, text)])
    expect(out.experience[0]!.bullets.at(-1)).toEqual({ text, sourceRef: text })
    expect(out.experience[0]!.bullets[0]).toEqual(profile.experience[0]!.bullets[0])
  })

  it("appends the sentence to a chosen project", () => {
    const text = "Bitirme projesinde HTML kullandım"
    const out = withDeclarations(profile, [experience(1, { section: "projects", index: 0 }, text)])
    expect(out.projects![0]!.bullets).toEqual([{ text, sourceRef: text }])
  })

  it("skips a target that is not in the profile", () => {
    expect(withDeclarations(profile, [experience(1, { section: "experience", index: 9 }, "Bir cümle yazdım burada")])).toEqual(profile)
  })

  it("adds an education entry without dates", () => {
    const out = withDeclarations(profile, [education(2, "Marmara Üniversitesi", "İşletme")])
    expect(out.education.at(-1)).toEqual({ school: "Marmara Üniversitesi", degree: null, field: "İşletme", startDate: null, endDate: null })
  })
})

describe("upsertDeclaration", () => {
  it("keeps one declaration per requirement, the latest", () => {
    expect(upsertDeclaration([skill(0, ["A"])], skill(0, ["B"]))).toEqual([skill(0, ["B"])])
  })
})

describe("removeDeclaration", () => {
  it("removes only that requirement's declaration", () => {
    expect(removeDeclaration([skill(0, ["A"]), skill(1, ["B"])], 0)).toEqual([skill(1, ["B"])])
  })
})

describe("markDeclarationEvidence", () => {
  it("marks evidence only on the declared requirement when it matched", () => {
    const scored = {
      requirements: [
        { status: "matched", evidence: { text: "HTML", matchText: "HTML", kind: "skill", sourceRef: null } },
        { status: "missing", evidence: null },
        { status: "matched", evidence: { text: "React", matchText: "React", kind: "skill", sourceRef: null } },
      ],
    } as unknown as ScoreResult
    const out = markDeclarationEvidence(scored, [skill(0, ["HTML"]), skill(1, ["Go"])])
    expect(out.requirements[0]!.evidence?.declared).toBe(true)
    expect(out.requirements[1]!.evidence).toBeNull()
    expect(out.requirements[2]!.evidence?.declared).toBeUndefined()
  })
})

describe("declareTargets", () => {
  it("offers jobs and projects as targets", () => {
    expect(declareTargets(profile)).toEqual([
      { section: "experience", index: 0, label: "Acme · Geliştirici" },
      { section: "projects", index: 0, label: "Bitirme" },
    ])
  })
})

describe("beyandan skora ve belgeye (K-114)", () => {
  const posting: JobPostingData = {
    position: "Geliştirici",
    company: null,
    seniority: null,
    language: "tr",
    requirements: [
      { text: "HTML bilgisi", type: "skill", importance: "must", concepts: [{ term: "HTML", synonyms: [] }] },
      { text: "React", type: "skill", importance: "must", concepts: [{ term: "React", synonyms: [] }] },
    ],
  }
  // Her metin kendi yönünde: anlamsal eşleşme olmasın, sonucu yalnızca kelime belirlesin.
  const embedding = {
    embed: async (texts: string[]) => texts.map((_, i) => texts.map((__, j) => (i === j ? 1 : 0))),
  }
  const statuses = async (result: unknown) =>
    (await scoreProfile({ profile: analysisProfile(profile, result), posting }, embedding)).requirements.map((r) => r.status)

  it("turns a missing skill into a match, and undoing brings it back", async () => {
    expect((await statuses({}))[0]).toBe("missing")
    expect((await statuses({ declarations: [skill(0, ["HTML"])] }))[0]).toBe("matched")
    expect((await statuses({ declarations: removeDeclaration([skill(0, ["HTML"])], 0) }))[0]).toBe("missing")
  })

  it("reaches the document even when the CV groups its skills", () => {
    const grouped = { ...profile, skills: ["React"], skillGroups: [{ name: "Frontend", items: ["React"] }] }
    const model = toDocumentModel(analysisProfile(grouped, { declarations: [skill(0, ["HTML"])] }))
    expect(JSON.stringify(model)).toContain("HTML")
  })
})
