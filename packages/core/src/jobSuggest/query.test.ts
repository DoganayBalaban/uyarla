import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import { suggestionQuery } from "./query.js"

const profile = (overrides: Partial<ResumeProfile> = {}): ResumeProfile => ({
  fullName: "Ece",
  headline: null,
  summary: null,
  experience: [
    { company: "Atlas", title: "Genel Muhasebe Uzmanı", startDate: "2022", endDate: "halen", bullets: [] },
    { company: "Kuzey", title: "Muhasebe Uzman Yardımcısı", startDate: "2020", endDate: "2021", bullets: [] },
  ],
  education: [],
  skills: ["Logo Tiger", "MS Excel", "e-Fatura"],
  languages: [],
  certifications: [],
  ...overrides,
})

describe("suggestionQuery", () => {
  it("prefers the target role the user chose in onboarding", () => {
    expect(suggestionQuery(profile(), { targetRole: "Mali İşler Uzmanı" }).keywords).toBe("Mali İşler Uzmanı")
  })

  it("falls back to the most recent job title", () => {
    expect(suggestionQuery(profile(), {}).keywords).toBe("Genel Muhasebe Uzmanı")
  })

  it("falls back to the top skills when there is no title", () => {
    expect(suggestionQuery(profile({ experience: [] }), {}).keywords).toBe("Logo Tiger MS Excel")
  })

  it("passes the city through and defaults to the whole country", () => {
    expect(suggestionQuery(profile(), { city: "İzmir" }).location).toBe("İzmir")
    expect(suggestionQuery(profile(), {}).location).toBe("Türkiye")
  })
})
