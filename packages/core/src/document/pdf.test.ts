import { describe, it, expect } from "vitest"
import { extractText } from "../documents/extractText.js"
import type { DocumentModel } from "./model.js"
import { renderPdf } from "./pdf.js"

const model: DocumentModel = {
  name: "Elif Yılmaz",
  contact: "Frontend Geliştirici",
  summary: "React odaklı geliştirici",
  sections: [
    {
      title: "DENEYİM",
      entries: [
        {
          heading: "Geliştirici · Acme",
          subheading: "2022-01 – halen",
          lines: ["React ile panel geliştirdim", "Test altyapısını kurdum"],
        },
      ],
    },
    {
      title: "BECERİLER",
      entries: [{ heading: null, subheading: null, lines: ["React, TypeScript"] }],
    },
  ],
}

describe("renderPdf", () => {
  it("geçerli bir PDF üretir", async () => {
    const pdf = await renderPdf(model)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("metin katmanı seçilebilir — kendi çıkarıcımızla okunuyor", async () => {
    // Tamamlanma tanımı bunu şart koşuyor (spec §14): taranmış görüntüye
    // benzeyen bir PDF ATS'ten geçmez.
    const metin = await extractText(await renderPdf(model), "cikti.pdf")
    expect(metin).toContain("React ile panel geliştirdim")
  })

  it("Türkçe karakterleri bozmadan yazar", async () => {
    // pdfkit'in gömülü Helvetica'sı WinAnsi kullanıyor ve ş/ğ/ı/İ orada yok.
    // Ölçüm: Helvetica ile "Geliştirici" → "Geli ÷F— ici".
    const metin = await extractText(await renderPdf(model), "cikti.pdf")
    expect(metin).toContain("Elif Yılmaz")
    expect(metin).toContain("Geliştirici")
    expect(metin).toContain("Test altyapısını kurdum")
  })

  it("bütün bölümleri ve maddeleri yazar", async () => {
    const metin = await extractText(await renderPdf(model), "cikti.pdf")
    for (const beklenen of [
      "DENEYİM",
      "BECERİLER",
      "Geliştirici · Acme",
      "2022-01 – halen",
      "Test altyapısını kurdum",
      "React, TypeScript",
    ]) {
      expect(metin).toContain(beklenen)
    }
  })

  it("özeti yazar", async () => {
    expect(await extractText(await renderPdf(model), "cikti.pdf")).toContain(
      "React odaklı geliştirici",
    )
  })

  it("özet ve iletişim yoksa çökmez", async () => {
    const pdf = await renderPdf({ ...model, summary: null, contact: null })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("uzun içerikte ikinci sayfaya taşar", async () => {
    const uzun: DocumentModel = {
      ...model,
      sections: [
        {
          title: "DENEYİM",
          entries: Array.from({ length: 40 }, (_, i) => ({
            heading: `Rol ${i} · Şirket ${i}`,
            subheading: "2020 – 2021",
            lines: ["Bir şeyler geliştirdim", "Başka şeyler geliştirdim"],
          })),
        },
      ],
    }
    const metin = await extractText(await renderPdf(uzun), "cikti.pdf")
    expect(metin).toContain("Rol 39 · Şirket 39")
  })

  it("bölümsüz modelde de geçerli PDF üretir", async () => {
    const pdf = await renderPdf({ ...model, sections: [] })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
