import Module from "node:module"
import { describe, it, expect } from "vitest"
import { extractText } from "../documents/extractText.js"
import type { DocumentModel } from "./model.js"
import { PDFParse } from "pdf-parse"
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
          heading: "Geliştirici",
          organization: "Acme",
          date: "2022-01 - halen",
          lines: ["React ile panel geliştirdim", "Test altyapısını kurdum"],
        },
      ],
    },
    {
      title: "BECERİLER",
      entries: [],
      rows: [{ label: null, text: "React, TypeScript" }],
    },
  ],
}

describe("renderPdf", () => {
  it("never loads pdfkit's built-in standard fonts", async () => {
    // Üretimde Sentry'nin modül kancası pdfkit'in `#standard-fonts/Helvetica`
    // iç importunu çözemiyor ve indirme 500 veriyordu (15 Ekim 2026). Biz zaten
    // kendi fontlarımızı kullanıyoruz; varsayılan Helvetica hiç yüklenmemeli.
    const loader = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown }
    const original = loader._load
    const requested: string[] = []
    loader._load = function (request: string, ...rest: unknown[]) {
      requested.push(request)
      return original.call(this, request, ...rest)
    }
    try {
      await renderPdf(model)
    } finally {
      loader._load = original
    }
    expect(requested.filter((r) => r.startsWith("#standard-fonts"))).toEqual([])
  })

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
      "2022-01 - halen",
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
            heading: `Rol ${i}`,
            organization: `Şirket ${i}`,
            date: "2020 - 2021",
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

  it("never leaves a bullet alone on a page at a page break", async () => {
    // Sayfa sonuna denk gelen madde imi yeni sayfaya taşıyor, metni bir
    // sonrakine kalıyordu: içinde yalnızca "•" olan sayfa (cv-c, 3 sayfa).
    // Sayfa sonunun maddelere göre konumu özetin uzunluğuyla kaydırılıyor.
    for (let words = 0; words <= 120; words += 6) {
      const long: DocumentModel = {
        ...model,
        summary: words ? "kelime ".repeat(words).trim() : null,
        sections: [
          {
            title: "DENEYİM",
            entries: [{ heading: "Rol", organization: "Şirket", date: "2020 - 2021", lines: Array.from({ length: 60 }, (_, i) => `Madde ${i}`) }],
          },
        ],
      }
      const { pages } = await new PDFParse({ data: await renderPdf(long) }).getText()
      for (const page of pages) expect(page.text.replace(/[\s•]/g, "").length).toBeGreaterThan(0)
      expect(pages.length).toBeLessThanOrEqual(2)
      expect(pages.at(-1)!.text).toContain("Madde 59")
    }
  })
})
