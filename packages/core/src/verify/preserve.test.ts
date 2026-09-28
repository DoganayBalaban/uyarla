import { describe, expect, it } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { preservesSource } from "./preserve.js"

const ilan: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "React ve TypeScript",
      type: "skill",
      importance: "must",
      concepts: [
        { term: "React", synonyms: [] },
        { term: "TypeScript", synonyms: [] },
      ],
    },
  ],
}

const kaynak = "React ve TypeScript ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azalttım."

describe("preservesSource", () => {
  it("terimi ifadenin yanına ekleyen yazımı kabul eder", () => {
    expect(
      preservesSource({
        rewritten:
          "React ve TypeScript ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azaltarak web performansını iyileştirdim.",
        source: kaynak,
        posting: ilan,
        bases: ["sayfa yüklenme süresini"],
      }).ok,
    ).toBe(true)
  })

  it("dayanağı silip yerine terimi yazan yazımı reddeder", () => {
    // Uçtan uca testte gerçekten üretilen cümle: anlam tersine dönmüştü.
    const sonuc = preservesSource({
      rewritten: "React ve TypeScript ile satıcı panelini baştan yazarak web performansı %40 azalttım.",
      source: kaynak,
      posting: ilan,
      bases: ["sayfa yüklenme süresini %40 azalttım"],
    })
    expect(sonuc.ok).toBe(false)
  })

  it("kaynakta geçen ilan kavramını düşüren yazımı reddeder", () => {
    const sonuc = preservesSource({
      rewritten: "React ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azalttım.",
      source: kaynak,
      posting: ilan,
    })
    expect(sonuc).toEqual({ ok: false, reason: "ilan kavramı kayboldu: TypeScript" })
  })

  it("kaynaktaki sayıyı düşüren yazımı reddeder", () => {
    // Özet yazımı "4 yıllık deneyim"i düşürmüştü.
    const sonuc = preservesSource({
      rewritten: "React ve TypeScript ile arayüz geliştiren bir geliştiriciyim.",
      source: "4 yıllık deneyime sahip, React ve TypeScript ile arayüz geliştiren bir geliştiriciyim.",
      posting: ilan,
    })
    expect(sonuc).toEqual({ ok: false, reason: "sayı kayboldu: 4" })
  })

  describe("fiil çekimi (eval:adapt, cv-c)", () => {
    const kaynak = "Öğrencilerin proje geliştirme süreçlerine teknik destek sağladım."
    const yaz = (rewritten: string, dayanak = "teknik destek sağladım.") =>
      preservesSource({ rewritten, source: kaynak, posting: ilan, bases: [dayanak] }).ok

    it("bağlaca çevrilen fiili dayanak sayar", () => {
      expect(
        yaz("Öğrencilerin proje geliştirme süreçlerine teknik destek sağlayarak problem çözme yetkinliklerini gösterdim."),
      ).toBe(true)
      expect(yaz("Eğitim içeriklerini sürekli geliştirerek yeni gelişmeleri takip ettim.", "sürekli geliştirdim")).toBe(
        true,
      )
    })

    it("kökü değişen fiili kabul etmez", () => {
      expect(
        yaz(
          "Akademik personel ve öğrenciler arasında iletişim süreçlerini erişim yönetimi ile sağladım.",
          "iletişim süreçlerini yönettim.",
        ),
      ).toBe(false)
    })

    it("olumsuzlanan fiili kabul etmez", () => {
      expect(yaz("Öğrencilere teknik destek sağlamadım.")).toBe(false)
    })

    it("fiilden önceki kelime değişirse kabul etmez", () => {
      expect(
        yaz("Organizasyon ve raporlama ile paydaş yönetimine katkı sağladım.", "ekip yönetimine katkı sağladım."),
      ).toBe(false)
    })
  })
})
