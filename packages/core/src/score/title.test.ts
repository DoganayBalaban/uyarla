import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import { titleMatch } from "./title.js"

function profile(headline: string | null, titles: string[]): ResumeProfile {
  return {
    fullName: null,
    headline,
    summary: null,
    experience: titles.map((title) => ({ company: "Acme", title, startDate: "2020", endDate: "2022", bullets: [] })),
    education: [],
    skills: [],
    languages: [],
    certifications: [],
  }
}

describe("titleMatch", () => {
  it("finds the posting title in an experience title, ignoring seniority", () => {
    expect(titleMatch("Senior Muhasebe Uzmanı", profile(null, ["Genel Muhasebe Uzmanı"]))).toEqual({
      position: "Senior Muhasebe Uzmanı",
      level: "exact",
      resumeTitle: "Genel Muhasebe Uzmanı",
    })
  })

  it("matches across languages through the synonym dictionary", () => {
    expect(titleMatch("Yazılım Mühendisi", profile(null, ["Software Engineer"]))?.level).toBe("exact")
    expect(titleMatch("Yapay Zeka Mühendisi / Yapay Zeka Geliştiricisi", profile(null, ["AI Engineer"]))?.level).toBe("exact")
  })

  it("takes only the title part of a headline that also carries location and contact", () => {
    const r = titleMatch("Satış Mühendisi", profile("Satış Mühendisi · Pendik, İstanbul · mert@ornek.com", []))
    expect(r).toMatchObject({ level: "exact", resumeTitle: "Satış Mühendisi" })
  })

  it("calls a title close when the role word and most other words match", () => {
    const r = titleMatch("Senior Digital Marketing Specialist", profile(null, ["Performance Marketing Specialist"]))
    expect(r).toMatchObject({ level: "partial", resumeTitle: "Performance Marketing Specialist" })
  })

  it("does not call a title close when only the generic role word is shared", () => {
    expect(titleMatch("İnsan Kaynakları Uzmanı", profile(null, ["Genel Muhasebe Uzmanı"]))?.level).toBe("none")
    expect(titleMatch("AI Engineer", profile(null, ["Software Testing Engineer"]))?.level).toBe("none")
  })

  it("prefers an exact match over an earlier close one", () => {
    const r = titleMatch(
      "Digital Marketing Specialist",
      profile(null, ["Performance Marketing Specialist", "Digital Marketing Specialist"]),
    )
    expect(r).toMatchObject({ level: "exact", resumeTitle: "Digital Marketing Specialist" })
  })

  it("ignores parenthetical notes and returns null for an empty title", () => {
    expect(titleMatch("AI Engineer (Remote)", profile(null, ["AI Engineer"]))?.level).toBe("exact")
    expect(titleMatch("(Tahmini)", profile(null, ["AI Engineer"]))).toBeNull()
  })

  it("leaves an inferred posting title out of the score (revision 3)", () => {
    // İlan unvan yazmayınca model bir tahmin yazıyor: "AI/ML Engineer (implied)".
    expect(titleMatch("AI/ML Engineer (implied)", profile("AI Engineer", []))).toBeNull()
    expect(titleMatch("AI/Yazılım Geliştirici (Tahmini)", profile(null, ["Yazılım Geliştirici"]))).toBeNull()
    expect(titleMatch("Frontend Developer (Remote)", profile(null, ["Frontend Developer"]))?.level).toBe("exact")
  })
})
