import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extractText } from "./extractText.js"
import { PermanentError } from "../errors.js"
import { ColumnBreak, Document, Packer, Paragraph, SectionType, TextRun } from "docx"

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

describe("extractText · two-column DOCX section (PDF → Word conversions)", () => {
  const bullet = (text: string, columnBreak = false) =>
    new Paragraph({ bullet: { level: 0 }, children: [...(columnBreak ? [new ColumnBreak()] : []), new TextRun(text)] })

  /** Beceriler iki sütunda; sütun sonundan önceki başlık sol sütunun dibinde kalıyor. */
  async function twoColumnDocx(orphan: string, left: string[], right: string[], after: Paragraph[]) {
    return Packer.toBuffer(
      new Document({
        sections: [
          { children: [new Paragraph("AYŞE DEMİR"), new Paragraph("SKILLS")] },
          {
            properties: { type: SectionType.CONTINUOUS, column: { count: 2, space: 720 } },
            children: [...left.map((s) => bullet(s)), new Paragraph(orphan), ...right.map((s, i) => bullet(s, i === 0))],
          },
          { properties: { type: SectionType.CONTINUOUS }, children: after },
        ],
      }),
    )
  }

  it("reads the right column before a heading orphaned at the bottom of the left column", async () => {
    const text = await extractText(
      await twoColumnDocx("EXPERIENCE", ["Metin Analizi", "Etkili İletişim"], ["Web Tasarımı (HTML/CSS)", "MS Office"], [
        new Paragraph("Türkçe Öğretmeni\tEki 2025 – Şub 2026"),
        bullet("Ders materyalleri hazırladı ve dört temel dil becerisini geliştirdi."),
      ]),
      "cv.docx",
    )
    const lines = text.split("\n")
    expect(lines.indexOf("MS Office")).toBeLessThan(lines.indexOf("EXPERIENCE"))
    expect(lines.indexOf("Web Tasarımı (HTML/CSS)")).toBeLessThan(lines.indexOf("EXPERIENCE"))
    expect(lines.indexOf("EXPERIENCE")).toBeLessThan(lines.findIndex((l) => l.startsWith("Türkçe Öğretmeni")))
  })

  it("leaves a heading that introduces a differently shaped right column where it is", async () => {
    // Sol sütunda eğitim kayıtları (madde değil), sağda beceri maddeleri: başlık sağ sütuna ait.
    const doc = await Packer.toBuffer(
      new Document({
        sections: [
          {
            properties: { column: { count: 2, space: 720 } },
            children: [
              new Paragraph("EDUCATION"),
              new Paragraph("Örnek Üniversitesi 2021–2025"),
              new Paragraph("Lisans | Türk Dili"),
              new Paragraph("SKILLS"),
              bullet("Metin Analizi", true),
              bullet("MS Office"),
            ],
          },
        ],
      }),
    )
    const lines = (await extractText(doc, "cv.docx")).split("\n")
    expect(lines.indexOf("SKILLS")).toBeLessThan(lines.indexOf("Metin Analizi"))
  })
})
