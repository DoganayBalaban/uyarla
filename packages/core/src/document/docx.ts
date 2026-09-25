import { BorderStyle, Document, Packer, Paragraph, TextRun } from "docx"
import type { DocumentModel } from "./model.js"

/** Marka rehberi §9.3: CV çıktısında marka fontu değil sistem fontu. */
const FONT = "Calibri"

/**
 * ATS dostu DOCX (spec §9).
 *
 * PDF ile aynı `DocumentModel`'den besleniyor: yerleşim kararları modelde,
 * bu dosya yalnızca çiziyor. Tablo, metin kutusu, üstbilgi/altbilgi yok.
 *
 * Yol haritası DOCX'i kesilebilir sayıyordu; korundu çünkü Türkiye'deki
 * kurumsal İK süreçlerinde hâlâ yaygın ve aynı ara yapıdan ikinci bir
 * üreteç ucuz (K-29).
 */
export async function renderDocx(model: DocumentModel): Promise<Buffer> {
  const paragraflar: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: model.name, bold: true, size: 40, font: FONT })],
    }),
  ]

  if (model.contact) {
    paragraflar.push(
      new Paragraph({
        children: [new TextRun({ text: model.contact, size: 20, font: FONT, color: "444444" })],
      }),
    )
  }

  if (model.summary) {
    paragraflar.push(
      new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({ text: model.summary, size: 20, font: FONT })],
      }),
    )
  }

  for (const section of model.sections) {
    paragraflar.push(
      new Paragraph({
        spacing: { before: 280, after: 80 },
        // Alt kenarlık, tablo değil: bölüm ayracı ATS'in metin katmanını
        // etkilemeden çiziliyor.
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
        children: [new TextRun({ text: section.title, bold: true, size: 22, font: FONT })],
      }),
    )

    for (const entry of section.entries) {
      if (entry.heading) {
        paragraflar.push(
          new Paragraph({
            children: [new TextRun({ text: entry.heading, bold: true, size: 20, font: FONT })],
          }),
        )
      }
      if (entry.subheading) {
        paragraflar.push(
          new Paragraph({
            children: [
              new TextRun({ text: entry.subheading, size: 18, font: FONT, color: "555555" }),
            ],
          }),
        )
      }
      for (const line of entry.lines) {
        paragraflar.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: line, size: 20, font: FONT })],
          }),
        )
      }
    }
  }

  const doc = new Document({ sections: [{ children: paragraflar }] })
  return Packer.toBuffer(doc)
}
