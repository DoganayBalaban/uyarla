import { describe, expect, it } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import {
  LinkedInProfileDataSchema,
  PROFILE_LIMITS,
  descriptionLines,
  fromResumeProfile,
  splitDateRange,
  toResumeProfile,
} from "./profileData.js"
import { deniz } from "./testProfile.js"

describe("splitDateRange", () => {
  it("splits LinkedIn date ranges and drops the duration", () => {
    expect(splitDateRange("Mar 2023 - Present · 2 yrs 8 mos")).toEqual({ start: "Mar 2023", end: "Present" })
    expect(splitDateRange("Oca 2020 – Ara 2022")).toEqual({ start: "Oca 2020", end: "Ara 2022" })
    expect(splitDateRange("2021")).toEqual({ start: "2021", end: "2021" })
    expect(splitDateRange(null)).toEqual({ start: "", end: "" })
  })
})

describe("descriptionLines", () => {
  it("keeps non-empty lines without bullet marks", () => {
    expect(descriptionLines("• Bir\n\n- İki \n  ")).toEqual(["Bir", "İki"])
    expect(descriptionLines(null)).toEqual([])
  })
})

describe("toResumeProfile", () => {
  it("maps sections so the existing helpers can read the profile", () => {
    const r = toResumeProfile(deniz())
    expect(r.fullName).toBe("Deniz Aksoy")
    expect(r.summary).toContain("performans pazarlaması")
    expect(r.experience[0]).toMatchObject({ company: "Moda Sepeti", startDate: "Mar 2023", endDate: "Present" })
    expect(r.experience[0]!.bullets.map((b) => b.text)).toEqual(["Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.", "GA4 panoları hazırladım."])
    expect(r.experience[0]!.bullets[0]!.sourceRef).toBe(r.experience[0]!.bullets[0]!.text)
    expect(r.education[0]).toMatchObject({ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", startDate: "2017", endDate: "2021" })
    expect(r.certifications).toEqual(["Google Ads Search Certification"])
  })
})

const resume = (): ResumeProfile => ({
  fullName: "Deniz Aksoy",
  headline: "Pazarlama",
  summary: null,
  experience: [{ company: "Acme", title: "Uzman", startDate: "2022", endDate: "halen", bullets: [{ text: "Bir", sourceRef: "Bir" }, { text: "İki", sourceRef: "İki" }] }],
  education: [{ school: "ODTÜ", degree: "Lisans", field: "İşletme", startDate: "2016", endDate: "2020" }],
  skills: ["SQL"],
  languages: [],
  certifications: ["PMP"],
})

describe("fromResumeProfile (PDF yolu)", () => {
  it("turns a parsed PDF profile into profile data with bullets as the description", () => {
    expect(fromResumeProfile(resume())).toEqual({
      name: "Deniz Aksoy",
      headline: "Pazarlama",
      about: null,
      experience: [{ title: "Uzman", company: "Acme", dateRange: "2022 - halen", location: null, description: "Bir\nİki" }],
      education: [{ school: "ODTÜ", degree: "Lisans, İşletme", dateRange: "2016 - 2020", description: null }],
      certifications: [{ name: "PMP", issuer: null, date: null }],
      skills: ["SQL"],
      languages: [],
      truncated: { skills: { shown: 1, total: null } },
    })
  })

  it("marks the skill list as partial: LinkedIn's PDF lists only the top skills", () => {
    const r = fromResumeProfile({ ...resume(), skills: ["SQL", "Excel", "Power BI"] })
    expect(r.truncated).toEqual({ skills: { shown: 3, total: null } })
  })

  it("drops contact and location parts the PDF reader merged into the headline", () => {
    const headline = (h: string | null) => fromResumeProfile({ ...resume(), headline: h }).headline
    expect(headline("Satış Mühendisi · Pendik, İstanbul · mert@ornek.com")).toBe("Satış Mühendisi")
    expect(headline("Performance Marketing · Google Ads, GA4 · linkedin.com/in/deniz")).toBe("Performance Marketing · Google Ads, GA4")
    expect(headline("Uzman • İstanbul, Türkiye • +90 555 000 00 00")).toBe("Uzman")
    expect(headline("Google Ads, GA4 · Ankara")).toBe("Google Ads, GA4")
    expect(headline("Pazarlama · Meta Ads | Google Ads, GA4")).toBe("Pazarlama · Meta Ads | Google Ads, GA4")
    expect(headline("mert@ornek.com")).toBeNull()
  })
})

describe("LinkedInProfileDataSchema", () => {
  it("trims text and accepts a normal profile", () => {
    const parsed = LinkedInProfileDataSchema.parse({ ...deniz(), headline: "  Başlık  " })
    expect(parsed.headline).toBe("Başlık")
  })

  it("rejects oversized text and too many items", () => {
    expect(LinkedInProfileDataSchema.safeParse({ ...deniz(), about: "a".repeat(PROFILE_LIMITS.text + 1) }).success).toBe(false)
    const many = Array.from({ length: PROFILE_LIMITS.experience + 1 }, () => deniz().experience[0]!)
    expect(LinkedInProfileDataSchema.safeParse({ ...deniz(), experience: many }).success).toBe(false)
  })
})
