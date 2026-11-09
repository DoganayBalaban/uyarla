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
import { documentHeader } from "./header.js"
import { linkParts, type TextPart } from "./links.js"
import type { DocumentEntry, DocumentModel } from "./model.js"
import { CV_STYLE, docxColor } from "./style.js"

/**
 * Marka rehberi §9.3: CV çıktısında marka fontu değil sistem fontu. PDF'teki
 * Carlito Calibri ile aynı ölçüde; LibreOffice Calibri yerine Carlito açıyor.
 */
const FONT = "Calibri"
const { color: C, size: SIZE, space: SPACE } = CV_STYLE
/** Punto → yarım punto (docx boyutu) ve twip (docx aralığı). */
const half = (pt: number) => Math.round(pt * 2)
const twip = (pt: number) => Math.round(pt * 20)
/** Gövde satır aralığı: punto + ek boşluk, 240'lık birimde (otomatik). */
const BODY_LINE = Math.round(240 * ((SIZE.body * 1.22 + CV_STYLE.lineGap) / (SIZE.body * 1.22)))

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
  const header = documentHeader(model.contact, model.language)
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: model.name, bold: true, size: half(SIZE.name), font: FONT, color: docxColor(C.ink) })],
    }),
  ]

  if (header.title) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: twip(SPACE.afterName) },
        children: [new TextRun({ text: header.title, size: half(SIZE.title), font: FONT, color: docxColor(C.soft) })],
      }),
    )
  }

  if (header.contacts.length > 0) {
    const parts = header.contacts.flatMap((part, i) =>
      i === 0 ? [part] : [{ text: CV_STYLE.contactSeparator, href: null, color: C.faint }, part],
    )
    paragraphs.push(
      new Paragraph({
        spacing: { before: twip(SPACE.afterTitle) },
        children: runs(parts, { size: half(SIZE.contact), color: C.soft }),
      }),
    )
  }

  if (model.summary) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: twip(SPACE.afterHeader), line: BODY_LINE },
        children: runs(linkParts(model.summary), { size: half(SIZE.body), color: C.ink }),
      }),
    )
  }

  for (const section of model.sections) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: twip(SPACE.section), after: twip(SPACE.afterRule) },
        keepNext: true,
        // Alt kenarlık, tablo değil: bölüm ayracı ATS'in metin katmanını
        // etkilemeden çiziliyor.
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: docxColor(C.rule), space: 2 } },
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: half(SIZE.heading),
            font: FONT,
            color: docxColor(C.ink),
            characterSpacing: twip(CV_STYLE.headingTracking),
          }),
        ],
      }),
    )

    section.entries.forEach((entry, i) => {
      if (entry.heading || entry.organization || entry.date) {
        paragraphs.push(entryHeader(entry, i > 0))
      }
      entry.lines.forEach((line, li) => {
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            // Başlıksız kayıt (sertifikalar) ikinci kayıtsa üstünde kayıt aralığı.
            spacing: {
              before: li === 0 && i > 0 && !(entry.heading || entry.organization || entry.date) ? twip(SPACE.entry) : 0,
              after: twip(SPACE.bullet),
              line: BODY_LINE,
            },
            children: runs(linkParts(line), { size: half(SIZE.body), color: C.ink }),
          }),
        )
      })
    })

    for (const row of section.rows ?? []) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: twip(SPACE.bullet), line: BODY_LINE },
          children: [
            ...(row.label
              ? [new TextRun({ text: `${row.label}: `, bold: true, size: half(SIZE.body), font: FONT, color: docxColor(C.ink) })]
              : []),
            ...runs(linkParts(row.text), { size: half(SIZE.body), color: C.ink }),
          ],
        }),
      )
    }
  }

  const doc = new Document({
    sections: [
      {
        // PDF ile aynı kenar boşlukları; sağa yaslı tarih bu genişliğe göre.
        properties: {
          page: {
            margin: { top: VERTICAL, bottom: VERTICAL, left: MARGIN, right: MARGIN },
          },
        },
        children: paragraphs,
      },
    ],
  })
  return Packer.toBuffer(doc)
}

/** A4 genişliği (twip) ve kenar boşlukları (stilden). */
const PAGE_WIDTH = 11906
const MARGIN = twip(CV_STYLE.margin.side)
const VERTICAL = twip(CV_STYLE.margin.vertical)

/**
 * Kayıt başlığı (DOG-106): kalın unvan, yanında kurum, tarih sağdaki sekme
 * durağında. Tablo değil, tek paragraf: ATS metni unvan · kurum · tarih
 * sırasıyla okuyor.
 */
function entryHeader(entry: DocumentEntry, spaced: boolean): Paragraph {
  const children: ParagraphChild[] = []
  if (entry.heading) {
    children.push(new TextRun({ text: entry.heading, bold: true, size: half(SIZE.entry), font: FONT, color: docxColor(C.ink) }))
  }
  if (entry.organization) {
    if (entry.heading) children.push(new TextRun({ text: " · ", size: half(SIZE.entry), font: FONT, color: docxColor(C.faint) }))
    children.push(new TextRun({ text: entry.organization, size: half(SIZE.entry), font: FONT, color: docxColor(C.soft) }))
  }
  if (entry.date) {
    children.push(new TextRun({ children: [new Tab(), entry.date], size: half(SIZE.meta), font: FONT, color: docxColor(C.soft) }))
  }
  return new Paragraph({
    spacing: { before: spaced ? twip(SPACE.entry) : 0, after: twip(SPACE.afterEntryHeader) },
    keepNext: true,
    tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH - 2 * MARGIN }],
    children,
  })
}

/** Parçaları koşulara çevirir; bağlantılar tıklanabilir (DOG-106). */
function runs(parts: Array<TextPart & { color?: string }>, style: { size: number; color: string }): ParagraphChild[] {
  return parts.map((part) => {
    // Bağlantı ayrı renkte değil (PDF ile aynı); tıklanabilirlik köprüde.
    const run = new TextRun({ text: part.text, size: style.size, font: FONT, color: docxColor(part.color ?? style.color) })
    return part.href ? new ExternalHyperlink({ link: part.href, children: [run] }) : run
  })
}
