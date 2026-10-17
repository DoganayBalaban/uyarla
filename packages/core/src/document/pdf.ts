import { fontPaths } from "@uyarla/fonts"
import PDFDocument from "pdfkit"
import { linkParts, type TextPart } from "./links.js"
import type { DocumentEntry, DocumentModel } from "./model.js"

/** ~2 cm kenar boşluğu. */
const MARGIN = 56
const TEXT = "#000"
const MUTED = "#444"
const LINK = "#1f4e9c"

/**
 * ATS dostu tek sütunlu PDF (spec §9).
 *
 * Tablo yok, metin kutusu yok, üstbilgi/altbilgi yok, grafik yok. Tarayıcı
 * kullanılmıyor: Puppeteer worker'a yüzlerce megabayt ekler ve bu yerleşim
 * onu gerektirmiyor. pdfkit ile doğrudan yazmak metnin seçilebilir olmasını
 * da garantiliyor — taranmış PDF'e benzer bir sonuç riski yok.
 */
export async function renderPdf(model: DocumentModel): Promise<Buffer> {
  const fontList = fontPaths()
  // Varsayılan font bizim gövde fontumuz: pdfkit aksi hâlde açılışta kendi
  // Helvetica'sını `#standard-fonts` iç importuyla yüklüyor. Üretimde Sentry'nin
  // modül kancası o importu çözemiyor ve indirme 500 veriyordu (15 Ekim 2026);
  // Helvetica'yı zaten kullanmıyoruz (Türkçe harfleri yok).
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, font: fontList.regular })
  doc.registerFont("govde", fontList.regular)
  doc.registerFont("kalin", fontList.bold)

  const fragments: Buffer[] = []
  doc.on("data", (fragment: Buffer) => fragments.push(fragment))
  const finished = new Promise<void>((resolve) => doc.on("end", () => resolve()))

  doc.font("kalin").fontSize(22).text(model.name)
  if (model.contact) {
    doc.moveDown(0.15)
    writeParts(doc, linkParts(model.contact, { bareDomains: true }), { font: "govde", size: 9.5, color: MUTED })
  }

  if (model.summary) {
    doc.moveDown(0.8)
    writeParts(doc, linkParts(model.summary), { font: "govde", size: 10, color: TEXT })
  }

  for (const section of model.sections) {
    keepWithNext(doc, 60)
    doc.moveDown(1).font("kalin").fontSize(11).fillColor(TEXT).text(section.title, MARGIN, doc.y, { characterSpacing: 0.6 })

    // İnce bir çizgi; grafik değil, bölüm ayracı. Metin katmanını
    // etkilemiyor, ATS tarafında görünmez.
    doc
      .moveTo(MARGIN, doc.y + 2)
      .lineTo(doc.page.width - MARGIN, doc.y + 2)
      .strokeColor("#999")
      .lineWidth(0.5)
      .stroke()
    doc.moveDown(0.5)

    for (const entry of section.entries) {
      if (entry.heading || entry.organization || entry.date) writeEntryHeader(doc, entry)
      for (const line of entry.lines) writeBullet(doc, line)
      doc.moveDown(0.5)
    }

    for (const row of section.rows ?? []) {
      const parts = linkParts(row.text)
      writeParts(doc, row.label ? [{ text: `${row.label}: `, href: null, bold: true }, ...parts] : parts, {
        font: "govde",
        size: 10,
        color: TEXT,
      })
      doc.moveDown(0.25)
    }
  }

  doc.end()
  await finished
  return Buffer.concat(fragments)
}

type Doc = PDFKit.PDFDocument

/** Sayfanın sonuna bu kadar yer kalmadıysa başlığı yeni sayfaya taşır. */
function keepWithNext(doc: Doc, height: number) {
  if (doc.y + height > doc.page.height - MARGIN) doc.addPage()
}

/**
 * Parçaları tek paragraf olarak yazar; bağlantılar tıklanabilir (DOG-106).
 * pdfkit'te `continued` ile aynı satırda font ve renk değişebiliyor.
 */
function writeParts(
  doc: Doc,
  parts: Array<TextPart & { bold?: boolean }>,
  style: { font: "govde" | "kalin"; size: number; color: string; x?: number; y?: number; width?: number },
) {
  const x = style.x ?? MARGIN
  const width = style.width ?? doc.page.width - MARGIN - x
  parts.forEach((part, i) => {
    doc
      .font(part.bold ? "kalin" : style.font)
      .fontSize(style.size)
      .fillColor(part.href ? LINK : style.color)
    const options = { width, continued: i < parts.length - 1, link: part.href ?? undefined }
    if (i === 0) doc.text(part.text, x, style.y ?? doc.y, options)
    else doc.text(part.text, options)
  })
  doc.fillColor(TEXT)
  doc.x = MARGIN
}

/**
 * Kayıt başlığı (DOG-106): kalın unvan, yanında kurum, tarih sağa yaslı ve
 * aynı satırda. Tek sütun: tarih ayrı bir sütun değil, satırın sağ ucu;
 * metin katmanında unvan · kurum · tarih sırasıyla okunuyor.
 */
function writeEntryHeader(doc: Doc, entry: DocumentEntry) {
  keepWithNext(doc, 40)
  const y = doc.y
  const fullWidth = doc.page.width - 2 * MARGIN
  doc.font("govde").fontSize(9.5)
  const dateWidth = entry.date ? doc.widthOfString(entry.date) + 12 : 0

  const parts: Array<TextPart & { bold?: boolean }> = []
  if (entry.heading) parts.push({ text: entry.heading, href: null, bold: true })
  if (entry.organization) parts.push({ text: `${entry.heading ? " · " : ""}${entry.organization}`, href: null })
  if (parts.length > 0) writeParts(doc, parts, { font: "govde", size: 10.5, color: TEXT, y, width: fullWidth - dateWidth })
  const after = doc.y

  if (entry.date) {
    doc.font("govde").fontSize(9.5).fillColor("#555").text(entry.date, MARGIN, y + 1, { width: fullWidth, align: "right" })
    doc.fillColor(TEXT)
  }
  doc.x = MARGIN
  doc.y = Math.max(after, doc.y)
  doc.moveDown(0.15)
}

/** Asılı girintili madde: satır kaydığında metin imin hizasında kalmıyor. */
function writeBullet(doc: Doc, line: string) {
  const y = doc.y
  doc.font("govde").fontSize(10).fillColor(TEXT).text("•", MARGIN + 4, y)
  writeParts(doc, linkParts(line), { font: "govde", size: 10, color: TEXT, x: MARGIN + 14, y })
  doc.moveDown(0.1)
}
