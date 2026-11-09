import { fontPaths } from "@uyarla/fonts"
import PDFDocument from "pdfkit"
import { documentHeader } from "./header.js"
import { linkParts, type TextPart } from "./links.js"
import type { DocumentEntry, DocumentModel } from "./model.js"
import { CV_STYLE } from "./style.js"

const { color: C, size: SIZE, space: SPACE } = CV_STYLE
const MARGIN = CV_STYLE.margin.side

/**
 * ATS dostu tek sütunlu PDF (spec §9).
 *
 * Tablo yok, metin kutusu yok, üstbilgi/altbilgi yok, grafik yok. Tarayıcı
 * kullanılmıyor: Puppeteer worker'a yüzlerce megabayt ekler ve bu yerleşim
 * onu gerektirmiyor. pdfkit ile doğrudan yazmak metnin seçilebilir olmasını
 * da garantiliyor — taranmış PDF'e benzer bir sonuç riski yok.
 */
export interface PdfOptions {
  /**
   * Sıkı yerleşim (DOG-93, tek sayfa stratejisi): üst ve alt kenar boşluğu
   * ile satır aralıkları daralıyor; yazı boyutu ve içerik aynı. Değerlendirme
   * CV'lerinden ikisi bir sayfayı yalnızca birkaç satırla aşıyordu.
   */
  compact?: boolean
}

export async function renderPdf(model: DocumentModel, options: PdfOptions = {}): Promise<Buffer> {
  return (await layoutPdf(model, options)).buffer
}

/** Belgenin kaç sayfa tuttuğu; tek sayfa planı (adapt/onePage.ts) bunu soruyor. */
export async function pdfPageCount(model: DocumentModel, options: PdfOptions = {}): Promise<number> {
  return (await layoutPdf(model, options)).pages
}

/** pdfkit'in fontkit'e verdiği OpenType özellikleri: kerning kapalı. */
const NO_KERNING = { kern: false } as unknown as string[]

/**
 * Kerning kapalı (DOG-166): harf arası düzeltmeler metin dizisine (TJ) sayı
 * olarak giriyor ve pypdf gibi okuyucular büyük olanları boşluk sanıyor:
 * "Google Tag Manager" → "Google T ag Manager". Bazı ATS'ler kelimeyi
 * bölebilir. Ölçüm (genişlik, yükseklik) de aynı ayarla; yoksa satır
 * kırılımı yazılandan farklı hesaplanır.
 */
function withoutKerning(doc: Doc): void {
  const withFeatures = <T extends unknown[]>(args: T): T => {
    const last = args.at(-1)
    if (last && typeof last === "object" && !Array.isArray(last)) {
      return [...args.slice(0, -1), { features: NO_KERNING, ...last }] as T
    }
    return [...args, { features: NO_KERNING }] as T
  }
  const text = doc.text.bind(doc) as (...args: unknown[]) => Doc
  const widthOfString = doc.widthOfString.bind(doc) as (...args: unknown[]) => number
  const heightOfString = doc.heightOfString.bind(doc) as (...args: unknown[]) => number
  doc.text = ((...args: unknown[]) => text(...withFeatures(args))) as Doc["text"]
  doc.widthOfString = ((...args: unknown[]) => widthOfString(...withFeatures(args))) as Doc["widthOfString"]
  doc.heightOfString = ((...args: unknown[]) => heightOfString(...withFeatures(args))) as Doc["heightOfString"]
}

async function layoutPdf(model: DocumentModel, options: PdfOptions): Promise<{ buffer: Buffer; pages: number }> {
  const fontList = fontPaths()
  const k = options.compact ? CV_STYLE.compactSpacing : 1
  const vertical = options.compact ? CV_STYLE.margin.compactVertical : CV_STYLE.margin.vertical
  // Varsayılan font bizim gövde fontumuz: pdfkit aksi hâlde açılışta kendi
  // Helvetica'sını `#standard-fonts` iç importuyla yüklüyor. Üretimde Sentry'nin
  // modül kancası o importu çözemiyor ve indirme 500 veriyordu (15 Ekim 2026);
  // Helvetica'yı zaten kullanmıyoruz (Türkçe harfleri yok).
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: vertical, bottom: vertical, left: MARGIN, right: MARGIN },
    font: fontList.regular,
  })
  withoutKerning(doc)
  let pages = 1
  doc.on("pageAdded", () => pages++)
  doc.registerFont("govde", fontList.regular)
  doc.registerFont("kalin", fontList.bold)

  const fragments: Buffer[] = []
  doc.on("data", (fragment: Buffer) => fragments.push(fragment))
  const finished = new Promise<void>((resolve) => doc.on("end", () => resolve()))
  const width = doc.page.width - 2 * MARGIN

  // Başlık: ad, unvan satırı, iletişim satırı (header.ts).
  const header = documentHeader(model.contact, model.language)
  doc.font("kalin").fontSize(SIZE.name).fillColor(C.ink).text(model.name, MARGIN, doc.y, { width, characterSpacing: -0.2 })
  if (header.title) {
    doc.y += SPACE.afterName
    doc.font("govde").fontSize(SIZE.title).fillColor(C.soft).text(header.title, MARGIN, doc.y, { width })
  }
  if (header.contacts.length > 0) {
    doc.y += SPACE.afterTitle
    const separated = header.contacts.flatMap((part, i) =>
      i === 0 ? [part] : [{ text: CV_STYLE.contactSeparator, href: null, faint: true }, part],
    )
    writeParts(doc, separated, { font: "govde", size: SIZE.contact, color: C.soft })
  }

  if (model.summary) {
    doc.y += SPACE.afterHeader * k
    writeParts(doc, linkParts(model.summary), { font: "govde", size: SIZE.body, color: C.ink })
  }

  for (const section of model.sections) {
    keepWithNext(doc, 60)
    doc.y += SPACE.section * k
    doc
      .font("kalin")
      .fontSize(SIZE.heading)
      .fillColor(C.ink)
      .text(section.title, MARGIN, doc.y, { width, characterSpacing: CV_STYLE.headingTracking })

    // İnce bir çizgi; grafik değil, bölüm ayracı. Metin katmanını
    // etkilemiyor, ATS tarafında görünmez.
    const ruleY = doc.y + 2.5
    doc.moveTo(MARGIN, ruleY).lineTo(MARGIN + width, ruleY).strokeColor(C.rule).lineWidth(0.6).stroke()
    doc.y = ruleY + SPACE.afterRule * k

    section.entries.forEach((entry, i) => {
      if (i > 0) doc.y += SPACE.entry * k
      if (entry.heading || entry.organization || entry.date) writeEntryHeader(doc, entry, k)
      for (const line of entry.lines) writeBullet(doc, line, k)
    })

    for (const row of section.rows ?? []) {
      const parts = linkParts(row.text)
      writeParts(doc, row.label ? [{ text: `${row.label}: `, href: null, bold: true }, ...parts] : parts, {
        font: "govde",
        size: SIZE.body,
        color: C.ink,
      })
      doc.y += SPACE.bullet * k
    }
  }

  doc.end()
  await finished
  return { buffer: Buffer.concat(fragments), pages }
}

type Doc = PDFKit.PDFDocument

/** Sayfanın sonuna bu kadar yer kalmadıysa başlığı yeni sayfaya taşır. */
function keepWithNext(doc: Doc, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage()
}

/**
 * Parçaları tek paragraf olarak yazar; bağlantılar tıklanabilir (DOG-106).
 * pdfkit'te `continued` ile aynı satırda font ve renk değişebiliyor.
 */
function writeParts(
  doc: Doc,
  parts: Array<TextPart & { bold?: boolean; faint?: boolean; soft?: boolean }>,
  style: { font: "govde" | "kalin"; size: number; color: string; x?: number; y?: number; width?: number },
) {
  const x = style.x ?? MARGIN
  const width = style.width ?? doc.page.width - MARGIN - x
  parts.forEach((part, i) => {
    doc
      .font(part.bold ? "kalin" : style.font)
      .fontSize(style.size)
      // Bağlantı ayrı renkte değil: belge tek renk ailesinde, tıklanabilirlik
      // metin katmanında (DOG-106).
      .fillColor(part.faint ? C.faint : part.soft ? C.soft : style.color)
    const options = { width, continued: i < parts.length - 1, link: part.href ?? undefined, lineGap: CV_STYLE.lineGap }
    if (i === 0) doc.text(part.text, x, style.y ?? doc.y, options)
    else doc.text(part.text, options)
  })
  doc.fillColor(C.ink)
  doc.x = MARGIN
}

/**
 * Kayıt başlığı (DOG-106): kalın unvan, yanında kurum, tarih sağa yaslı ve
 * aynı satırda. Tek sütun: tarih ayrı bir sütun değil, satırın sağ ucu;
 * metin katmanında unvan · kurum · tarih sırasıyla okunuyor.
 */
function writeEntryHeader(doc: Doc, entry: DocumentEntry, k: number) {
  keepWithNext(doc, 40)
  const y = doc.y
  const fullWidth = doc.page.width - 2 * MARGIN
  doc.font("govde").fontSize(SIZE.meta)
  const dateWidth = entry.date ? doc.widthOfString(entry.date) + 14 : 0

  const parts: Array<TextPart & { bold?: boolean; faint?: boolean; soft?: boolean }> = []
  if (entry.heading) parts.push({ text: entry.heading, href: null, bold: true })
  if (entry.organization) {
    if (entry.heading) parts.push({ text: " · ", href: null, faint: true })
    parts.push({ text: entry.organization, href: null, soft: true })
  }
  if (parts.length > 0) writeParts(doc, parts, { font: "govde", size: SIZE.entry, color: C.ink, y, width: fullWidth - dateWidth })
  const after = doc.y

  if (entry.date) {
    doc.font("govde").fontSize(SIZE.meta).fillColor(C.soft).text(entry.date, MARGIN, y + 1.2, { width: fullWidth, align: "right" })
    doc.fillColor(C.ink)
  }
  doc.x = MARGIN
  doc.y = Math.max(after, doc.y) + SPACE.afterEntryHeader * k
}

/** Asılı girintili madde: satır kaydığında metin imin hizasında kalmıyor. */
function writeBullet(doc: Doc, line: string, k = 1) {
  // İm ile metin aynı y'ye açık konumla yazılıyor; sayfa sonunda im yeni
  // sayfaya taşıp metin eski y'de kalırsa, içinde yalnızca "•" olan bir sayfa
  // ve fazladan bir sayfa çıkıyordu. Maddenin ilk satırı sığmıyorsa önce
  // sayfa çevriliyor.
  doc.font("govde").fontSize(SIZE.body)
  keepWithNext(doc, doc.currentLineHeight(true) + 2)
  const y = doc.y
  doc.fillColor(C.faint).text("•", MARGIN + CV_STYLE.bullet.mark, y)
  writeParts(doc, linkParts(line), { font: "govde", size: SIZE.body, color: C.ink, x: MARGIN + CV_STYLE.bullet.text, y })
  doc.y += SPACE.bullet * k
}
