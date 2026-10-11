import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extractText } from "./extractText.js"
import { PermanentError } from "../errors.js"

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "__fixtures__", name))

describe("extractText", () => {
  it("extracts text from a DOCX file", async () => {
    const text = await extractText(fixture("ornek-cv.docx"), "ornek-cv.docx")
    expect(text).toContain("Deneyim")
    expect(text.length).toBeGreaterThan(100)
  })

  it("extracts text from a PDF file", async () => {
    const text = await extractText(fixture("ornek-cv.pdf"), "ornek-cv.pdf")
    expect(text).toContain("Deneyim")
  })

  it("returns a separate error code for a PDF without a text layer", async () => {
    await expect(
      extractText(fixture("taranmis.pdf"), "taranmis.pdf"),
    ).rejects.toMatchObject({ code: "scanned_pdf" })
  })

  it("the scanned PDF message tells the user what to do", async () => {
    await expect(
      extractText(fixture("taranmis.pdf"), "taranmis.pdf"),
    ).rejects.toThrow(/Word|metin katmanı/i)
  })

  it("gives an unreadable error for a corrupt PDF", async () => {
    await expect(
      extractText(Buffer.from("bu bir PDF degil"), "bozuk.pdf"),
    ).rejects.toMatchObject({ code: "unreadable_file" })
  })

  it("throws a permanent error for an unsupported extension", async () => {
    await expect(
      extractText(Buffer.from("merhaba"), "cv.txt"),
    ).rejects.toBeInstanceOf(PermanentError)
  })

  it("recognizes an uppercase extension", async () => {
    const text = await extractText(fixture("ornek-cv.docx"), "ORNEK-CV.DOCX")
    expect(text).toContain("Deneyim")
  })
})

describe("extractText · DOCX tables (DOG-60)", () => {
  async function docxWithTable(rows: string[][][]): Promise<Buffer> {
    const { Document, Packer, Paragraph, Table, TableCell, TableRow } = await import("docx")
    const table = new Table({
      rows: rows.map(
        (r) =>
          new TableRow({
            children: r.map((paras) => new TableCell({ children: paras.map((t) => new Paragraph(t)) })),
          }),
      ),
    })
    return Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("YETKİNLİKLER"), table] }] }))
  }

  it("keeps a row of single-line cells on one line", async () => {
    // Hücreler ayrı satıra düşünce "MS Office" etiket, "İleri" beceri sanılıyordu.
    const text = await extractText(
      await docxWithTable([
        [["Alan"], ["Düzey"]],
        [["MS Office (Excel, PowerPoint)"], ["İleri"]],
        [["Salesforce CRM"], ["Orta"]],
      ]),
      "cv.docx",
    )
    expect(text).toContain("MS Office (Excel, PowerPoint) | İleri")
    expect(text).toContain("Salesforce CRM | Orta")
  })

  it("leaves multi-paragraph cells on separate lines", async () => {
    const text = await extractText(
      await docxWithTable([[["2022 – Halen"], ["Genel Muhasebe Uzmanı", "Atlas Lojistik", "▪ Mizan kontrolü"]]]),
      "cv.docx",
    )
    expect(text).toContain("Genel Muhasebe Uzmanı\nAtlas Lojistik\n▪ Mizan kontrolü")
  })

  it("drops empty cells from a row", async () => {
    const text = await extractText(await docxWithTable([[["EĞİTİM VE ÖĞRETİM"], [""]]]), "cv.docx")
    expect(text.split("\n")).toContain("EĞİTİM VE ÖĞRETİM")
  })
})
