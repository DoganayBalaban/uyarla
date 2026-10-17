import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  type ParagraphChild,
  Tab,
  TabStopType,
  TextRun,
} from "docx"
import { linkParts, type TextPart } from "./links.js"
import type { DocumentEntry, DocumentModel } from "./model.js"

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
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: model.name, bold: true, size: 44, font: FONT })],
    }),
  ]

  if (model.contact) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40 },
        children: runs(linkParts(model.contact, { bareDomains: true }), { size: 19, color: "444444" }),
      }),
    )
  }

  if (model.summary) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 160 },
        children: runs(linkParts(model.summary), { size: 20 }),
      }),
    )
  }

  for (const section of model.sections) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 280, after: 80 },
        keepNext: true,
        // Alt kenarlık, tablo değil: bölüm ayracı ATS'in metin katmanını
        // etkilemeden çiziliyor.
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
        children: [new TextRun({ text: section.title, bold: true, size: 22, font: FONT, characterSpacing: 12 })],
      }),
    )

    section.entries.forEach((entry, i) => {
      if (entry.heading || entry.organization || entry.date) {
        paragraphs.push(entryHeader(entry, i > 0))
      }
      for (const line of entry.lines) {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: runs(linkParts(line), { size: 20 }),
          }),
        )
      }
    })

    for (const row of section.rows ?? []) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            ...(row.label ? [new TextRun({ text: `${row.label}: `, bold: true, size: 20, font: FONT })] : []),
            ...runs(linkParts(row.text), { size: 20 }),
          ],
        }),
      )
    }
  }

  const doc = new Document({
    sections: [
      {
        // PDF ile aynı ~2 cm kenar boşluğu; sağa yaslı tarih bu genişliğe göre.
        properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
        children: paragraphs,
      },
    ],
  })
  return Packer.toBuffer(doc)
}

/** A4 genişliği (twip) ve ~2 cm kenar boşluğu. */
const PAGE_WIDTH = 11906
const MARGIN = 1134

/**
 * Kayıt başlığı (DOG-106): kalın unvan, yanında kurum, tarih sağdaki sekme
 * durağında. Tablo değil, tek paragraf: ATS metni unvan · kurum · tarih
 * sırasıyla okuyor.
 */
function entryHeader(entry: DocumentEntry, spaced: boolean): Paragraph {
  const children: ParagraphChild[] = []
  if (entry.heading) children.push(new TextRun({ text: entry.heading, bold: true, size: 21, font: FONT }))
  if (entry.organization) {
    children.push(new TextRun({ text: `${entry.heading ? " · " : ""}${entry.organization}`, size: 21, font: FONT }))
  }
  if (entry.date) {
    children.push(new TextRun({ children: [new Tab(), entry.date], size: 19, font: FONT, color: "555555" }))
  }
  return new Paragraph({
    spacing: { before: spaced ? 140 : 0, after: 20 },
    keepNext: true,
    tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH - 2 * MARGIN }],
    children,
  })
}

/** Parçaları koşulara çevirir; bağlantılar tıklanabilir (DOG-106). */
function runs(parts: TextPart[], style: { size: number; color?: string }): ParagraphChild[] {
  return parts.map((part) =>
    part.href
      ? new ExternalHyperlink({
          link: part.href,
          children: [new TextRun({ text: part.text, size: style.size, font: FONT, color: "1F4E9C" })],
        })
      : new TextRun({ text: part.text, size: style.size, font: FONT, color: style.color }),
  )
}
