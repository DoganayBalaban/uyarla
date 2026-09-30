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
  it("produces a valid DOCX", async () => {
    // DOCX bir zip; imzası PK.
    const buf = await renderDocx(model)
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })

  it("its text is readable by our own extractor", async () => {
    const text = await extractText(await renderDocx(model), "cikti.docx")
    expect(text).toContain("React ile panel geliştirdim")
  })

  it("writes Turkish characters intact", async () => {
    const text = await extractText(await renderDocx(model), "cikti.docx")
    expect(text).toContain("Elif Yılmaz")
    expect(text).toContain("Geliştirici")
    expect(text).toContain("Test altyapısını kurdum")
  })

  it("writes all sections and bullets", async () => {
    const text = await extractText(await renderDocx(model), "cikti.docx")
    for (const expected of [
      "DENEYİM",
      "BECERİLER",
      "Geliştirici · Acme",
      "2022-01 – halen",
      "Test altyapısını kurdum",
      "React, TypeScript",
      "React odaklı geliştirici",
    ]) {
      expect(text).toContain(expected)
    }
  })

  it("writes the same text as the PDF", async () => {
    // İki üreteç tek modelden besleniyor. İçerik ayrışırsa modelin değil
    // üreteçlerin karar verdiği anlamına gelir — ara yapının varlık sebebi
    // tam olarak bunu engellemek (spec §9).
    const withoutSpaces = (s: string) => s.replace(/[\s•]+/g, " ").trim()
    const pdfText = withoutSpaces(await extractText(await renderPdf(model), "c.pdf"))
    const docxText = withoutSpaces(await extractText(await renderDocx(model), "c.docx"))

    for (const entry of model.sections.flatMap((s) => s.entries)) {
      for (const lineItem of entry.lines) {
        expect(pdfText).toContain(withoutSpaces(lineItem))
        expect(docxText).toContain(withoutSpaces(lineItem))
      }
    }
  })

  it("does not crash without summary and contact", async () => {
    const buf = await renderDocx({ ...model, summary: null, contact: null })
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })

  it("produces a valid DOCX for a model without sections", async () => {
    const buf = await renderDocx({ ...model, sections: [] })
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })
})
