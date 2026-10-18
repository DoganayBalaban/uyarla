import { describe, expect, it } from "vitest"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import { conceptKey, correctPosting, profileExclusions } from "./exclusions.js"

const req = (text: string, terms: Array<string | [string, ...string[]]>, type: Requirement["type"] = "skill"): Requirement => ({
  text,
  type,
  importance: "must",
  concepts: terms.map((t) => (Array.isArray(t) ? { term: t[0], synonyms: t.slice(1) } : { term: t, synonyms: [] })),
})

const posting: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    req("React", [["React", "React.js"]]),
    req("Docker ve Kubernetes", ["Docker", "Kubernetes"]),
    req("En az 5 yıl deneyim", ["frontend geliştirme"], "experience"),
    req("Bilgisayar Mühendisliği mezunu", ["Bilgisayar Mühendisliği"], "education"),
    req("Takım çalışması", []),
  ],
}

describe("conceptKey", () => {
  it("normalizes Turkish case and whitespace", () => {
    expect(conceptKey("  İletişim   Becerisi ")).toBe("iletişim becerisi")
    expect(conceptKey("SQL")).toBe(conceptKey("sql"))
  })
})

describe("profileExclusions", () => {
  it("excludes a requirement only when every concept is on the list", () => {
    expect(profileExclusions(posting, ["docker"])).toEqual([])
    expect(profileExclusions(posting, ["docker", "kubernetes"])).toEqual([1])
  })

  it("matches through synonyms", () => {
    expect(profileExclusions(posting, ["react.js"])).toEqual([0])
  })

  it("never excludes a requirement without concepts", () => {
    expect(profileExclusions(posting, ["takım çalışması"])).toEqual([])
  })

  it("is empty for an empty list", () => {
    expect(profileExclusions(posting, [])).toEqual([])
  })
})

describe("correctPosting", () => {
  it("sets the minimum years on a requirement", () => {
    const fixed = correctPosting(posting, { 2: { minYears: 2 } })
    expect(fixed.requirements[2]).toMatchObject({ minYears: 2 })
    // Asıl ilan değişmiyor.
    expect(posting.requirements[2]).not.toHaveProperty("minYears")
  })

  it("replaces the concepts with the corrected terms", () => {
    const fixed = correctPosting(posting, { 3: { terms: ["Bilgisayar Mühendisliği", "ilgili bölümler"] } })
    expect(fixed.requirements[3]!.concepts.map((c) => c.term)).toEqual(["Bilgisayar Mühendisliği", "ilgili bölümler"])
  })

  it("ignores blank terms and unknown indexes", () => {
    const fixed = correctPosting(posting, { 3: { terms: ["  ", ""] }, 99: { minYears: 1 } })
    expect(fixed.requirements[3]!.concepts.map((c) => c.term)).toEqual(["Bilgisayar Mühendisliği"])
    expect(fixed.requirements).toHaveLength(posting.requirements.length)
  })
})
