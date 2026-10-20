import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import { searchLinks } from "./links.js"
import { suggestionQuery } from "./query.js"

const profile = (over: Partial<ResumeProfile>): ResumeProfile => ({
  fullName: null,
  headline: null,
  summary: null,
  experience: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
  ...over,
})
const job = (title: string) => ({ company: "Acme", title, startDate: "2022", endDate: "halen", bullets: [] })

describe("İlan bul (DOG-68)", () => {
  it("builds the query from the target role, else the last title, else two skills", () => {
    const p = profile({ experience: [job("Muhasebe Uzmanı")], skills: ["Excel", "Logo", "SAP"] })
    expect(suggestionQuery(p, { targetRole: "Mali İşler Müdürü" }).keywords).toBe("Mali İşler Müdürü")
    expect(suggestionQuery(p, {}).keywords).toBe("Muhasebe Uzmanı")
    expect(suggestionQuery(profile({ skills: ["Excel", "Logo", "SAP"] }), {}).keywords).toBe("Excel Logo")
    expect(suggestionQuery(profile({}), {}).keywords).toBe("")
  })

  it("encodes Turkish characters and spaces, adds the city only where it is supported", () => {
    const links = searchLinks({ keywords: "Muhasebe Uzmanı", city: "İstanbul" })
    expect(links.map((l) => l.url)).toEqual([
      "https://www.kariyer.net/is-ilanlari?kw=Muhasebe%20Uzman%C4%B1",
      "https://www.linkedin.com/jobs/search/?keywords=Muhasebe%20Uzman%C4%B1&location=%C4%B0stanbul%2C%20T%C3%BCrkiye",
      "https://tr.jooble.org/SearchResult?ukw=Muhasebe%20Uzman%C4%B1&rgns=%C4%B0stanbul",
      "https://www.careerjet.com.tr/arama/isler?s=Muhasebe%20Uzman%C4%B1&l=%C4%B0stanbul",
    ])
  })

  it("searches all of Türkiye without a city and nothing without keywords", () => {
    const links = searchLinks({ keywords: "Frontend" })
    expect(links[1]!.url).toBe("https://www.linkedin.com/jobs/search/?keywords=Frontend&location=T%C3%BCrkiye")
    expect(links[2]!.url).toBe("https://tr.jooble.org/SearchResult?ukw=Frontend")
    expect(searchLinks({ keywords: "  " })).toEqual([])
  })
})
