import { describe, it, expect } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import { toDocumentModel } from "./model.js"

const resumeProfile: ResumeProfile = {
  fullName: "Elif Yılmaz",
  headline: "Frontend Geliştirici",
  summary: "React odaklı geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022-01",
      endDate: "halen",
      bullets: [
        { text: "React ile panel geliştirdim", sourceRef: "x" },
        { text: "Test yazdım", sourceRef: "y" },
      ],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar", startDate: null, endDate: "2021" }],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce (C1)"],
  certifications: ["AWS Cloud Practitioner"],
}

describe("toDocumentModel", () => {
  it("carries the name and summary", () => {
    const m = toDocumentModel(resumeProfile)
    expect(m.name).toBe("Elif Yılmaz")
    expect(m.summary).toBe("React odaklı geliştirici")
  })

  it("does not leave the name blank when missing", () => {
    // Adsız bir CV üretmek kullanıcıyı utandırır; başlıksız bir belge
    // ATS'te de kimliksiz kalır.
    expect(toDocumentModel({ ...resumeProfile, fullName: null }).name).toBe("İsimsiz")
  })

  it("renders experience with title · company and date range", () => {
    const experienceEntry = toDocumentModel(resumeProfile).sections.find((s) => s.title === "DENEYİM")!
    expect(experienceEntry.entries[0]!.heading).toBe("Geliştirici · Acme")
    expect(experienceEntry.entries[0]!.subheading).toBe("2022-01 – halen")
    expect(experienceEntry.entries[0]!.lines).toEqual(["React ile panel geliştirdim", "Test yazdım"])
  })

  it("uses standard section headings", () => {
    // ATS kuralı (spec §9): tarayıcılar bölümleri başlıktan tanıyor.
    expect(toDocumentModel(resumeProfile).sections.map((s) => s.title)).toEqual([
      "DENEYİM",
      "EĞİTİM",
      "BECERİLER",
      "DİLLER",
      "SERTİFİKALAR",
    ])
  })

  it("keeps skill order", () => {
    const skill = toDocumentModel(resumeProfile).sections.find((s) => s.title === "BECERİLER")!
    expect(skill.entries[0]!.lines).toEqual(["React, TypeScript"])
  })

  it("never writes an empty section", () => {
    const empty = toDocumentModel({ ...resumeProfile, languages: [], certifications: [] })
    expect(empty.sections.map((s) => s.title)).toEqual(["DENEYİM", "EĞİTİM", "BECERİLER"])
  })

  it("skips missing education fields", () => {
    const m = toDocumentModel({
      ...resumeProfile,
      education: [{ school: "İTÜ", degree: null, field: null, startDate: null, endDate: null }],
    })
    const educationEntry = m.sections.find((s) => s.title === "EĞİTİM")!
    expect(educationEntry.entries[0]!.heading).toBe("İTÜ")
    expect(educationEntry.entries[0]!.subheading).toBeNull()
  })

  it("leaves summary null when absent", () => {
    expect(toDocumentModel({ ...resumeProfile, summary: null }).summary).toBeNull()
  })

  it("treats an empty summary as null", () => {
    // Uyarlama reddedilmiş bir özette boş metin bırakabiliyor; belgede
    // başlıksız bir boşluk çıkmasın.
    expect(toDocumentModel({ ...resumeProfile, summary: "   " }).summary).toBeNull()
  })

  it("uses the headline as the contact line", () => {
    expect(toDocumentModel(resumeProfile).contact).toBe("Frontend Geliştirici")
  })

  it("does not crash for a profile without experience", () => {
    const empty = toDocumentModel({
      ...resumeProfile,
      experience: [],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    })
    expect(empty.sections).toEqual([])
    expect(empty.name).toBe("Elif Yılmaz")
  })
})

describe("toDocumentModel · language", () => {
  it("writes section headings in English for an English resume", () => {
    const m = toDocumentModel({
      ...resumeProfile,
      summary: "Frontend developer with 4 years of experience building web applications.",
      experience: [
        {
          company: "Acme",
          title: "Frontend Developer",
          startDate: "2022",
          endDate: "Present",
          bullets: [{ text: "Built the dashboard with React and reduced load time by 40%", sourceRef: "Built the dashboard with React and reduced load time by 40%" }],
        },
      ],
    })
    expect(m.sections.map((s) => s.title)).toContain("EXPERIENCE")
    expect(m.sections.map((s) => s.title)).not.toContain("DENEYİM")
  })
})
