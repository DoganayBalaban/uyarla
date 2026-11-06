import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { checkDeclaration, declareContext } from "@/server/declarations"

const profile = {
  experience: [{ company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [] }],
  education: [],
  skills: [],
  projects: [],
} as unknown as ResumeProfile

const missing = (missingConcepts: string[], text = "HTML bilgisi", type = "skill") => ({
  requirement: { text, type, concepts: missingConcepts.map((term) => ({ term, synonyms: [] })) },
  missingConcepts,
})

describe("checkDeclaration", () => {
  it("allows a skill term only from the missing concepts", () => {
    expect(checkDeclaration({ kind: "skill", terms: ["HTML"] }, missing(["HTML"]), profile)).toBe("ok")
    expect(checkDeclaration({ kind: "skill", terms: ["Rust"] }, missing(["HTML"]), profile)).toBe("unknown_term")
  })

  it("never writes the requirement text or a duration note as a skill", () => {
    expect(checkDeclaration({ kind: "skill", terms: ["HTML bilgisi"] }, missing([]), profile)).toBe("unknown_term")
    const note = "En az 3 yıl deneyim (CV'de ~1 yıl)"
    const withNote = { ...missing(["React"]), missingConcepts: ["React", note] }
    expect(checkDeclaration({ kind: "skill", terms: [note] }, withNote, profile)).toBe("unknown_term")
  })

  it("takes one option of a group, not the group itself", () => {
    const group = missing(["Jest / Cypress"])
    expect(checkDeclaration({ kind: "skill", terms: ["Jest"] }, group, profile)).toBe("ok")
    expect(checkDeclaration({ kind: "skill", terms: ["Jest / Cypress"] }, group, profile)).toBe("unknown_term")
  })

  it("matches the form to the requirement type", () => {
    expect(checkDeclaration({ kind: "skill", terms: ["3 yıl"] }, missing(["3 yıl"], "3 yıl", "experience"), profile)).toBe("wrong_kind")
    expect(checkDeclaration({ kind: "skill", terms: ["Takım"] }, missing(["Takım"], "Takım", "soft"), profile)).toBe("wrong_kind")
  })

  it("rejects a target outside the profile", () => {
    const declaration = { kind: "experience" as const, target: { section: "experience" as const, index: 9 }, text: "Bir cümle yazdım burada" }
    expect(checkDeclaration(declaration, missing([], "x", "experience"), profile)).toBe("unknown_target")
  })
})

describe("declareContext", () => {
  it("offers the CV's jobs and locks once an adaptation exists", () => {
    const row = { result: {}, resumeVersion: { profile } }
    expect(declareContext({ ...row, adaptation: null })).toEqual({
      locked: false,
      targets: [{ section: "experience", index: 0, label: "Acme · Geliştirici" }],
    })
    expect(declareContext({ ...row, adaptation: { id: "a" } })?.locked).toBe(true)
  })

  it("is absent without a stored CV", () => {
    expect(declareContext({ result: {}, resumeVersion: null, adaptation: null })).toBeUndefined()
  })
})
