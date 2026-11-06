import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { checkDeclaration, declareContext } from "@/server/declarations"

const profile = {
  experience: [{ company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [] }],
  education: [],
  skills: [],
  projects: [],
} as unknown as ResumeProfile

const missing = (missingConcepts: string[], text = "HTML bilgisi", type = "skill") => ({ requirement: { text, type }, missingConcepts })

describe("checkDeclaration", () => {
  it("allows a skill term only from the missing concepts", () => {
    expect(checkDeclaration({ kind: "skill", terms: ["HTML"] }, missing(["HTML"]), profile)).toBe("ok")
    expect(checkDeclaration({ kind: "skill", terms: ["Rust"] }, missing(["HTML"]), profile)).toBe("unknown_term")
  })

  it("falls back to the requirement text when no concept is missing", () => {
    expect(checkDeclaration({ kind: "skill", terms: ["HTML bilgisi"] }, missing([]), profile)).toBe("ok")
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
