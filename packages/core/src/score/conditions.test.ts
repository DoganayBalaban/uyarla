import { describe, expect, it } from "vitest"
import type { Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { matchCondition } from "./conditions.js"
import { collectEvidence } from "./evidence.js"

const condition = (text: string): Requirement => ({
  text,
  importance: "must",
  type: "condition",
  concepts: [{ term: text, synonyms: [] }],
})

const profile = (extra: Partial<ResumeProfile> = {}): ResumeProfile => ({
  fullName: "Ayşe Yılmaz",
  headline: "Saha Satış Temsilcisi",
  summary: null,
  experience: [
    {
      company: "Acme Gıda, Ankara",
      title: "Satış Temsilcisi",
      startDate: "2021",
      endDate: "halen",
      bullets: [{ text: "Seyahat acentesi müşterilerine satış yaptım", sourceRef: "x" }],
    },
  ],
  education: [],
  skills: ["CRM"],
  languages: [],
  certifications: [],
  ...extra,
})

const run = (text: string, p: ResumeProfile) => matchCondition(condition(text), p, collectEvidence(p))

describe("matchCondition", () => {
  it("finds the driving licence in other sections", () => {
    const p = profile({ otherSections: [{ heading: "Kişisel Bilgiler", lines: ["B Sınıfı Ehliyet (2015)"] }] })
    const result = run("B sınıfı sürücü belgesine sahip ve aktif araç kullanan", p)
    expect(result.status).toBe("matched")
    expect(result.evidence?.text).toContain("Ehliyet")
  })

  it("reads a bare licence class as the answer to a driving requirement", () => {
    const p = profile({ skills: ["Salesforce CRM", "B sınıfı", "aktif"] })
    expect(run("Aktif araç kullanabilen", p)).toMatchObject({ status: "matched", evidence: { text: "B sınıfı" } })
    // Ehliyet sorulmuyorsa sınıf satırı bir şeye cevap değil.
    expect(run("Şehir dışı seyahat engeli bulunmayan", p).status).toBe("missing")
  })

  it("finds military status written as deferral", () => {
    const p = profile({ otherSections: [{ heading: "Kişisel", lines: ["Askerlik Durumu: Tecilli"] }] })
    expect(run("Erkek adaylar için askerlik görevini tamamlamış ya da tecilli", p).status).toBe("matched")
  })

  it("matches the English driving licence and certifications", () => {
    const p = profile({ certifications: ["Driver's License (B)"] })
    expect(run("Valid driver's license", p).status).toBe("matched")
  })

  it("matches residence by city, with the Turkish suffix", () => {
    expect(run("Ankara'da ikamet ediyor olmak", profile()).status).toBe("matched")
    expect(run("İstanbul'da ikamet eden", profile()).status).toBe("missing")
  })

  it("never matches conditions the CV cannot answer by keyword", () => {
    // Maddede "seyahat" geçiyor ama şartın cevabı değil.
    const result = run("Şehir dışı seyahat engeli bulunmayan", profile())
    expect(result).toEqual({ status: "missing", evidence: null })
  })

  it("does not take an office-days requirement as residence", () => {
    expect(run("Ankara ofisimizden haftada 3 gün çalışabilecek", profile()).status).toBe("missing")
  })
})
