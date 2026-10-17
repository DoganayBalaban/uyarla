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

  it("renders experience with title, company and date range as separate parts", () => {
    const experienceEntry = toDocumentModel(resumeProfile).sections.find((s) => s.title === "DENEYİM")!
    expect(experienceEntry.entries[0]!.heading).toBe("Geliştirici")
    expect(experienceEntry.entries[0]!.organization).toBe("Acme")
    expect(experienceEntry.entries[0]!.date).toBe("2022-01 – halen")
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

  it("puts education before experience for a first job search", () => {
    const titles = toDocumentModel(resumeProfile, { educationFirst: true }).sections.map((s) => s.title)
    expect(titles.slice(0, 2)).toEqual(["EĞİTİM", "DENEYİM"])
  })

  it("keeps skill order", () => {
    const skill = toDocumentModel(resumeProfile).sections.find((s) => s.title === "BECERİLER")!
    expect(skill.rows).toEqual([{ label: null, text: "React, TypeScript" }])
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
    expect(educationEntry.entries[0]!.organization).toBeNull()
    expect(educationEntry.entries[0]!.date).toBeNull()
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

describe("toDocumentModel · projects and other sections (DOG-105)", () => {
  const withProjects: ResumeProfile = {
    ...resumeProfile,
    projects: [
      {
        name: "Yeni Nesil Asistan",
        role: "Bitirme projesi",
        startDate: null,
        endDate: "2026",
        bullets: [{ text: "RAG ile kurumsal belge asistanı geliştirdim.", sourceRef: "x" }],
      },
      { name: "AI Workflow Platform", role: null, startDate: null, endDate: null, bullets: [] },
    ],
    otherSections: [{ heading: "Gönüllü Çalışmalar", lines: ["TEMA Vakfı fidan dikimi, 2023"] }],
  }

  it("puts projects right after experience, with role and date", () => {
    const m = toDocumentModel(withProjects)
    expect(m.sections.map((s) => s.title).slice(0, 3)).toEqual(["DENEYİM", "PROJELER", "EĞİTİM"])
    expect(m.sections[1]!.entries[0]).toEqual({
      heading: "Yeni Nesil Asistan",
      organization: "Bitirme projesi",
      date: "2026",
      lines: ["RAG ile kurumsal belge asistanı geliştirdim."],
    })
    expect(m.sections[1]!.entries[1]).toMatchObject({ heading: "AI Workflow Platform", organization: null, date: null })
  })

  it("writes sections it does not structure at the end, under their own heading", () => {
    const m = toDocumentModel(withProjects)
    expect(m.sections.at(-1)).toEqual({
      title: "GÖNÜLLÜ ÇALIŞMALAR",
      entries: [{ heading: null, organization: null, date: null, lines: ["TEMA Vakfı fidan dikimi, 2023"] }],
    })
  })

  it("keeps older profiles without these fields unchanged", () => {
    expect(toDocumentModel(resumeProfile).sections.map((s) => s.title)).not.toContain("PROJELER")
  })
})

describe("toDocumentModel · layout (DOG-106)", () => {
  it("writes the resume's own skill categories as labelled rows, in resume order", () => {
    const m = toDocumentModel({
      ...resumeProfile,
      skills: ["TypeScript", "React", "PostgreSQL", "Docker"],
      skillGroups: [
        { name: "Frontend", items: ["React", "TypeScript"] },
        { name: "Backend", items: ["PostgreSQL"] },
      ],
    })
    expect(m.sections.find((s) => s.title === "BECERİLER")!.rows).toEqual([
      // Grup içinde uyarlamanın sırası: TypeScript öne alınmış.
      { label: "Frontend", text: "TypeScript, React" },
      { label: "Backend", text: "PostgreSQL" },
      // Hiçbir gruba girmeyen (uyarlamanın eklediği) beceri sonda.
      { label: null, text: "Docker" },
    ])
  })

  it("drops a group whose skills are all gone", () => {
    const m = toDocumentModel({
      ...resumeProfile,
      skills: ["React"],
      skillGroups: [
        { name: "Frontend", items: ["React"] },
        { name: "Ops", items: ["Kubernetes"] },
      ],
    })
    expect(m.sections.find((s) => s.title === "BECERİLER")!.rows).toEqual([{ label: "Frontend", text: "React" }])
  })

  it("follows the resume's section order", () => {
    const m = toDocumentModel({ ...resumeProfile, sectionOrder: ["skills", "education", "experience"] })
    expect(m.sections.map((s) => s.title)).toEqual(["BECERİLER", "DİLLER", "SERTİFİKALAR", "EĞİTİM", "DENEYİM"])
  })

  it("the resume's own order wins over education-first", () => {
    // K2: "mevcut CV formatımı bozmasın". Eğitimi sona koyan aday bunu bilerek yapmış.
    const m = toDocumentModel({ ...resumeProfile, sectionOrder: ["experience", "education"] }, { educationFirst: true })
    expect(m.sections.map((s) => s.title).slice(0, 2)).toEqual(["DENEYİM", "EĞİTİM"])
  })

  it("puts a section missing from the recorded order at its default place", () => {
    // Projeler başlıksız (deneyimin içinde) yazılmış olabilir; deneyimin ardına.
    const m = toDocumentModel({
      ...resumeProfile,
      projects: [{ name: "Asistan", role: null, startDate: null, endDate: null, bullets: [] }],
      sectionOrder: ["education", "experience", "skills"],
    })
    expect(m.sections.map((s) => s.title).slice(0, 3)).toEqual(["EĞİTİM", "DENEYİM", "PROJELER"])
  })

  it("writes a single date when only one end is known", () => {
    const m = toDocumentModel({ ...resumeProfile, experience: [{ ...resumeProfile.experience[0]!, startDate: "", endDate: "2024" }] })
    expect(m.sections[0]!.entries[0]!.date).toBe("2024")
  })
})

describe("toDocumentModel · line breaks", () => {
  it("joins a line break left inside a bullet by the PDF", () => {
    const m = toDocumentModel({
      ...resumeProfile,
      experience: [{ ...resumeProfile.experience[0]!, bullets: [{ text: "login, filtering and cart\nfunctionalities.", sourceRef: "x" }] }],
    })
    expect(m.sections[0]!.entries[0]!.lines).toEqual(["login, filtering and cart functionalities."])
  })
})
