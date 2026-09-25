import { describe, it, expect } from "vitest"
import { extractText } from "../documents/extractText.js"
import type { DocumentModel } from "./model.js"
import { renderDocx } from "./docx.js"
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

describe("renderDocx", () => {
  it("geçerli bir DOCX üretir", async () => {
    // DOCX bir zip; imzası PK.
    const buf = await renderDocx(model)
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })

  it("metni kendi çıkarıcımızla okunabiliyor", async () => {
    const metin = await extractText(await renderDocx(model), "cikti.docx")
    expect(metin).toContain("React ile panel geliştirdim")
  })

  it("Türkçe karakterleri bozmadan yazar", async () => {
    const metin = await extractText(await renderDocx(model), "cikti.docx")
    expect(metin).toContain("Elif Yılmaz")
    expect(metin).toContain("Geliştirici")
    expect(metin).toContain("Test altyapısını kurdum")
  })

  it("bütün bölümleri ve maddeleri yazar", async () => {
    const metin = await extractText(await renderDocx(model), "cikti.docx")
    for (const beklenen of [
      "DENEYİM",
      "BECERİLER",
      "Geliştirici · Acme",
      "2022-01 – halen",
      "Test altyapısını kurdum",
      "React, TypeScript",
      "React odaklı geliştirici",
    ]) {
      expect(metin).toContain(beklenen)
    }
  })

  it("PDF ile aynı metni yazar", async () => {
    // İki üreteç tek modelden besleniyor. İçerik ayrışırsa modelin değil
    // üreteçlerin karar verdiği anlamına gelir — ara yapının varlık sebebi
    // tam olarak bunu engellemek (spec §9).
    const bosluksuz = (s: string) => s.replace(/[\s•]+/g, " ").trim()
    const pdfMetni = bosluksuz(await extractText(await renderPdf(model), "c.pdf"))
    const docxMetni = bosluksuz(await extractText(await renderDocx(model), "c.docx"))

    for (const entry of model.sections.flatMap((s) => s.entries)) {
      for (const satir of entry.lines) {
        expect(pdfMetni).toContain(bosluksuz(satir))
        expect(docxMetni).toContain(bosluksuz(satir))
      }
    }
  })

  it("özet ve iletişim yoksa çökmez", async () => {
    const buf = await renderDocx({ ...model, summary: null, contact: null })
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })

  it("bölümsüz modelde de geçerli DOCX üretir", async () => {
    const buf = await renderDocx({ ...model, sections: [] })
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })
})
