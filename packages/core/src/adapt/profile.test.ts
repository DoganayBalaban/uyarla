import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { applyAdaptation, bulletId } from "./profile.js"

const profil: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: "Frontend geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Test yazdım", sourceRef: "Test yazdım" },
      ],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar", endDate: "2021" }],
  skills: ["Excel", "React"],
  languages: ["İngilizce"],
  certifications: ["AWS"],
}

const taslak: AdaptationDraft = {
  summary: {
    original: "Frontend geliştirici",
    rewritten: "React odaklı frontend geliştirici",
    verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: bulletId(0, 0),
      experienceIndex: 0,
      original: "React ile panel yaptım",
      sourceRef: "React ile panel yaptım",
      rewritten: "React ile müşteri panelini geliştirdim",
      verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
    {
      id: bulletId(0, 1),
      experienceIndex: 0,
      original: "Test yazdım",
      sourceRef: "Test yazdım",
      rewritten: "Birim test altyapısını kurdum",
      verification: { status: "flagged", issues: [{ kind: "semantic_drift", detail: "…" }] },
      decision: "rejected",
    },
  ],
  skillOrder: ["React", "Excel"],
}

describe("bulletId", () => {
  it("deneyim ve madde sırasından kararlı bir kimlik üretir", () => {
    expect(bulletId(0, 0)).toBe("0-0")
    expect(bulletId(2, 5)).toBe("2-5")
  })
})

describe("applyAdaptation", () => {
  it("kabul edilen maddeyi yeniden yazımla değiştirir", () => {
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.experience[0]!.bullets[0]!.text).toBe("React ile müşteri panelini geliştirdim")
  })

  it("reddedilen maddede orijinali korur", () => {
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.experience[0]!.bullets[1]!.text).toBe("Test yazdım")
  })

  it("karara bağlanmamış maddede orijinali korur", () => {
    // pending, henüz onaylanmamış demek; kabul edilmiş gibi davranmak
    // kullanıcının görmediği metni CV'sine koyardı.
    const bekleyen: AdaptationDraft = {
      ...taslak,
      bullets: [{ ...taslak.bullets[0]!, decision: "pending" }],
    }
    expect(applyAdaptation(profil, bekleyen).experience[0]!.bullets[0]!.text).toBe(
      "React ile panel yaptım",
    )
  })

  it("sourceRef'i her zaman korur", () => {
    // Doğrulamanın kaynağı bu; yeniden yazımla değişmemeli.
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.experience[0]!.bullets[0]!.sourceRef).toBe("React ile panel yaptım")
  })

  it("kabul edilen özeti kullanır", () => {
    expect(applyAdaptation(profil, taslak).summary).toBe("React odaklı frontend geliştirici")
  })

  it("reddedilen özette orijinali korur", () => {
    const red: AdaptationDraft = {
      ...taslak,
      summary: { ...taslak.summary, decision: "rejected" },
    }
    expect(applyAdaptation(profil, red).summary).toBe("Frontend geliştirici")
  })

  it("özetsiz CV'de özeti null bırakır", () => {
    // Hat özetsiz CV için boş bir yeniden yazımı "accepted" olarak yazıyor;
    // bu, null özeti "" yapmamalı.
    const ozetsiz: AdaptationDraft = {
      ...taslak,
      summary: { ...taslak.summary, original: null, rewritten: "" },
    }
    expect(applyAdaptation({ ...profil, summary: null }, ozetsiz).summary).toBeNull()
  })

  it("becerileri taslaktaki sıraya göre dizer", () => {
    expect(applyAdaptation(profil, taslak).skills).toEqual(["React", "Excel"])
  })

  it("skillOrder'da olmayan beceriyi düşürmez", () => {
    // Küme değişmezliği (K-27) burada da korunmalı: eksik bir sıralama
    // sessizce beceri silemez.
    const eksik: AdaptationDraft = { ...taslak, skillOrder: ["React"] }
    expect(applyAdaptation(profil, eksik).skills.sort()).toEqual(["Excel", "React"])
  })

  it("eğitim, dil ve sertifikaları değiştirmez", () => {
    // Bunlar olgudur; ilana göre değişecek ifade payı yok (spec §6.4).
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.education).toEqual(profil.education)
    expect(sonuc.languages).toEqual(profil.languages)
    expect(sonuc.certifications).toEqual(profil.certifications)
  })

  it("girdi profilini değiştirmez", () => {
    applyAdaptation(profil, taslak)
    expect(profil.experience[0]!.bullets[0]!.text).toBe("React ile panel yaptım")
  })

  it("taslakta karşılığı olmayan maddeyi orijinal bırakır", () => {
    const bos: AdaptationDraft = { ...taslak, bullets: [] }
    expect(applyAdaptation(profil, bos).experience[0]!.bullets[0]!.text).toBe(
      "React ile panel yaptım",
    )
  })
})
