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
  it("produces a valid PDF", async () => {
    const pdf = await renderPdf(model)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("text layer is selectable — readable by our own extractor", async () => {
    // Tamamlanma tanımı bunu şart koşuyor (spec §14): taranmış görüntüye
    // benzeyen bir PDF ATS'ten geçmez.
    const text = await extractText(await renderPdf(model), "cikti.pdf")
    expect(text).toContain("React ile panel geliştirdim")
  })

  it("writes Turkish characters intact", async () => {
    // pdfkit'in gömülü Helvetica'sı WinAnsi kullanıyor ve ş/ğ/ı/İ orada yok.
    // Ölçüm: Helvetica ile "Geliştirici" → "Geli ÷F— ici".
    const text = await extractText(await renderPdf(model), "cikti.pdf")
    expect(text).toContain("Elif Yılmaz")
    expect(text).toContain("Geliştirici")
    expect(text).toContain("Test altyapısını kurdum")
  })

  it("writes all sections and bullets", async () => {
    const text = await extractText(await renderPdf(model), "cikti.pdf")
    for (const expected of [
      "DENEYİM",
      "BECERİLER",
      "Geliştirici · Acme",
      "2022-01 – halen",
      "Test altyapısını kurdum",
      "React, TypeScript",
    ]) {
      expect(text).toContain(expected)
    }
  })

  it("writes the summary", async () => {
    expect(await extractText(await renderPdf(model), "cikti.pdf")).toContain(
      "React odaklı geliştirici",
    )
  })

  it("does not crash without summary and contact", async () => {
    const pdf = await renderPdf({ ...model, summary: null, contact: null })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("flows to a second page for long content", async () => {
    const long: DocumentModel = {
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
    const text = await extractText(await renderPdf(long), "cikti.pdf")
    expect(text).toContain("Rol 39 · Şirket 39")
  })

  it("produces a valid PDF for a model without sections", async () => {
    const pdf = await renderPdf({ ...model, sections: [] })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
