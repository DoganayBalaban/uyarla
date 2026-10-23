import { describe, expect, it } from "vitest"
import { profileFromSnapshot, type ProfileSnapshot } from "./snapshot.js"

const snapshot = (over: Partial<ProfileSnapshot> = {}): ProfileSnapshot => ({
  url: "https://www.linkedin.com/in/deniz-aksoy/",
  own: true,
  name: "Deniz Aksoy",
  headline: "Performance Marketing Specialist",
  about: "E-ticaret ve ajans tarafında dört yıllık deneyimim var.",
  sections: {
    experience: {
      items: [
        ["Performance Marketing Specialist", "Moda Sepeti · Full-time", "Mar 2023 - Present · 2 yrs 8 mos", "İstanbul, Türkiye · Hybrid", "• Meta kampanyalarını yönettim.", "• GA4 panoları hazırladım.", "Skills: Google Ads · GA4"],
        ["Digital Marketing Executive", "Parlak Dijital Ajans", "Eyl 2021 - Şub 2023 · 1 yıl 6 ay"],
      ],
      showAllText: "Tüm 4 deneyimi göster",
    },
    education: { items: [["Marmara Üniversitesi", "Lisans, İşletme", "2017 - 2021", "Activities and societies: Pazarlama Kulübü"]], showAllText: null },
    certifications: { items: [["Google Ads Search Certification", "Google", "Issued Jan 2024", "Credential ID 123"]], showAllText: null },
    skills: { items: [["Google Ads"], ["Looker Studio"]], showAllText: "Show all 12 skills" },
    languages: { items: [["İngilizce", "Professional working proficiency"]], showAllText: null },
  },
  ...over,
})

describe("profileFromSnapshot", () => {
  it("reads a role: title, company without employment type, dates, location, description without skills line", () => {
    const p = profileFromSnapshot(snapshot())
    expect(p.experience[0]).toEqual({
      title: "Performance Marketing Specialist",
      company: "Moda Sepeti",
      dateRange: "Mar 2023 - Present · 2 yrs 8 mos",
      location: "İstanbul, Türkiye · Hybrid",
      description: "• Meta kampanyalarını yönettim.\n• GA4 panoları hazırladım.",
    })
    expect(p.experience[1]).toMatchObject({ company: "Parlak Dijital Ajans", location: null, description: null })
  })

  it("reads education, certifications, skills and languages", () => {
    const p = profileFromSnapshot(snapshot())
    expect(p.education[0]).toEqual({ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "2017 - 2021", description: "Activities and societies: Pazarlama Kulübü" })
    expect(p.certifications[0]).toEqual({ name: "Google Ads Search Certification", issuer: "Google", date: "Jan 2024" })
    expect(p.skills).toEqual(["Google Ads", "Looker Studio"])
    expect(p.languages).toEqual(["İngilizce"])
  })

  it("records truncated sections from the 'show all' links (Turkish and English)", () => {
    const p = profileFromSnapshot(snapshot())
    expect(p.truncated.experience).toEqual({ shown: 2, total: 4 })
    expect(p.truncated.skills).toEqual({ shown: 2, total: 12 })
    expect(p.truncated.education).toBeUndefined()
  })

  it("handles a role without company line and missing sections", () => {
    const p = profileFromSnapshot(snapshot({ sections: { experience: { items: [["Kurucu", "2020 - Present"]], showAllText: null } } }))
    expect(p.experience[0]).toEqual({ title: "Kurucu", company: null, dateRange: "2020 - Present", location: null, description: null })
    expect(p.education).toEqual([])
    expect(p.skills).toEqual([])
  })

  it("drops LinkedIn's 'see more' labels", () => {
    const p = profileFromSnapshot(snapshot({ sections: { experience: { items: [["Uzman", "Acme", "2022 - Present", "Kampanya yönettim…", "…daha fazla göster"]], showAllText: null } } }))
    expect(p.experience[0]!.description).toBe("Kampanya yönettim…")
  })
})
