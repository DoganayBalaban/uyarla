import { describe, it, expect } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import { toDocumentModel } from "./model.js"

const profil: ResumeProfile = {
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
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar", endDate: "2021" }],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce (C1)"],
  certifications: ["AWS Cloud Practitioner"],
}

describe("toDocumentModel", () => {
  it("adı ve özeti taşır", () => {
    const m = toDocumentModel(profil)
    expect(m.name).toBe("Elif Yılmaz")
    expect(m.summary).toBe("React odaklı geliştirici")
  })

  it("adı yoksa boş bırakmaz", () => {
    // Adsız bir CV üretmek kullanıcıyı utandırır; başlıksız bir belge
    // ATS'te de kimliksiz kalır.
    expect(toDocumentModel({ ...profil, fullName: null }).name).toBe("İsimsiz")
  })

  it("deneyimi unvan · kurum ve tarih aralığıyla verir", () => {
    const deneyim = toDocumentModel(profil).sections.find((s) => s.title === "DENEYİM")!
    expect(deneyim.entries[0]!.heading).toBe("Geliştirici · Acme")
    expect(deneyim.entries[0]!.subheading).toBe("2022-01 – halen")
    expect(deneyim.entries[0]!.lines).toEqual(["React ile panel geliştirdim", "Test yazdım"])
  })

  it("standart bölüm başlıkları kullanır", () => {
    // ATS kuralı (spec §9): tarayıcılar bölümleri başlıktan tanıyor.
    expect(toDocumentModel(profil).sections.map((s) => s.title)).toEqual([
      "DENEYİM",
      "EĞİTİM",
      "BECERİLER",
      "DİLLER",
      "SERTİFİKALAR",
    ])
  })

  it("beceri sırasını korur", () => {
    const beceri = toDocumentModel(profil).sections.find((s) => s.title === "BECERİLER")!
    expect(beceri.entries[0]!.lines).toEqual(["React, TypeScript"])
  })

  it("boş bölümü hiç yazmaz", () => {
    const bos = toDocumentModel({ ...profil, languages: [], certifications: [] })
    expect(bos.sections.map((s) => s.title)).toEqual(["DENEYİM", "EĞİTİM", "BECERİLER"])
  })

  it("eğitimde eksik alanları atlar", () => {
    const m = toDocumentModel({
      ...profil,
      education: [{ school: "İTÜ", degree: null, field: null, endDate: null }],
    })
    const egitim = m.sections.find((s) => s.title === "EĞİTİM")!
    expect(egitim.entries[0]!.heading).toBe("İTÜ")
    expect(egitim.entries[0]!.subheading).toBeNull()
  })

  it("özet yoksa null bırakır", () => {
    expect(toDocumentModel({ ...profil, summary: null }).summary).toBeNull()
  })

  it("boş özeti null sayar", () => {
    // Uyarlama reddedilmiş bir özette boş metin bırakabiliyor; belgede
    // başlıksız bir boşluk çıkmasın.
    expect(toDocumentModel({ ...profil, summary: "   " }).summary).toBeNull()
  })

  it("başlığı iletişim satırı olarak kullanır", () => {
    expect(toDocumentModel(profil).contact).toBe("Frontend Geliştirici")
  })

  it("deneyimi olmayan profilde çökmez", () => {
    const bos = toDocumentModel({
      ...profil,
      experience: [],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    })
    expect(bos.sections).toEqual([])
    expect(bos.name).toBe("Elif Yılmaz")
  })
})
