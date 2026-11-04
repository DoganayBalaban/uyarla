import mammoth from "mammoth"
import { PermanentError } from "../errors.js"
import { sectionHeading } from "../extract/segment.js"
import { orderColumns, type TextItem } from "./pdfLayout.js"

/**
 * Bu uzunluğun altındaki PDF metni, metin katmanı yok sayılır.
 * Taranmış belgeler tümüyle boş dönmeyebilir; gömülü üstbilgi ya da
 * damgadan birkaç karakter sızabiliyor.
 */
const SCANNED_PDF_THRESHOLD = 20

const UNREADABLE_MESSAGE =
  "Dosyanı okuyamadık. PDF veya DOCX olarak tekrar yüklemeyi dener misin?"

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop()

  if (ext === "pdf") return extractFromPdf(buffer)
  if (ext === "docx") return extractFromDocx(buffer)

  throw new PermanentError(
    "Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.",
    "unsupported_format",
  )
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Tembel yükleniyor: pdf-parse'ın ESM derlemesi (pdfjs-dist) Next'in
  // sunucu katmanında değerlendirilemiyor ("Object.defineProperty called on
  // non-object"). Üst seviyede import edilirse @uyarla/core'u import eden
  // her Next dosyası bu hatayı alır. Ayrıca pdfjs ağır bir bağımlılık;
  // yalnızca PDF işlenirken yüklenmesi doğru.
  const { PDFParse } = await import("pdf-parse")
  // pdfjs veriyi işçiye aktarırken diziyi boşaltabiliyor; iki okuma ayrı kopya alıyor.
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  let pages: string[]
  try {
    pages = (await parser.getText()).pages.map((p) => p.text)
  } catch {
    throw new PermanentError(UNREADABLE_MESSAGE, "unreadable_file")
  } finally {
    // pdfjs arka planda çalışan bir görev tutuyor; bırakılmazsa süreç kapanmaz.
    await parser.destroy()
  }

  // İki sütunlu sayfalar sütun sütun okunuyor (DOG-31); sütun bulunamayan
  // sayfada pdf-parse'ın metni aynen kalıyor. Konum okuması patlarsa da öyle:
  // sıra düzeltmesi bir iyileştirme, okumayı engellememeli.
  const columnText = await readColumns(buffer).catch(() => [])
  const text = pages
    .map((pageText, i) => columnText[i] ?? pageText)
    .join("\n\n")
    .trim()

  if (text.length < SCANNED_PDF_THRESHOLD) {
    // Ayrı mesaj şart: "okuyamadık" diyen bir hata kullanıcıyı aynı dosyayı
    // tekrar yüklemeye iter ve aynı sonucu alır.
    throw new PermanentError(
      "Bu PDF taranmış bir görüntü, içinde seçilebilir metin yok. " +
        "CV'ni Word veya metin katmanı olan bir PDF olarak yükler misin?",
      "scanned_pdf",
    )
  }

  return text
}

/** Her sayfa için sütun sırasıyla metin; sütunsuz sayfada null. */
async function readColumns(buffer: Buffer): Promise<Array<string | null>> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise
  try {
    const result: Array<string | null> = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const [x0, , x1] = page.view as [number, number, number, number]
      const content = await page.getTextContent()
      const items: TextItem[] = []
      for (const item of content.items) {
        if (!("str" in item)) continue
        items.push({
          str: item.str,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: item.width,
          height: item.height,
        })
      }
      result.push(orderColumns(items, x1 - x0))
    }
    return result
  } finally {
    await doc.destroy()
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    // Ham metin yerine HTML: tablo satırları ancak orada görünüyor (DOG-60).
    const { value } = await mammoth.convertToHtml({ buffer }, { transformDocument: liftOrphanHeadings })
    return docxHtmlToText(value).trim()
  } catch {
    throw new PermanentError(UNREADABLE_MESSAGE, "unreadable_file")
  }
}

/** mammoth'un belge ağacından bize gereken kısım. */
interface DocxNode {
  type: string
  children?: DocxNode[]
  value?: string
  breakType?: string
  styleId?: string | null
  numbering?: { level: string; isOrdered: boolean } | null
}

function nodeText(node: DocxNode): string {
  if (node.type === "text") return node.value ?? ""
  return (node.children ?? []).map(nodeText).join("")
}

/** Paragraf bir sütun sonuyla mı başlıyor (sağ sütunun ilk satırı). */
function startsWithColumnBreak(node: DocxNode): boolean {
  const first = (function find(n: DocxNode): DocxNode | null {
    if (n.type === "break" || (n.type === "text" && n.value?.trim())) return n
    for (const child of n.children ?? []) {
      const hit = find(child)
      if (hit) return hit
    }
    return null
  })(node)
  return first?.type === "break" && first.breakType === "column"
}

/** İki paragraf aynı listenin maddesi gibi mi: aynı stil, aynı madde düzeyi, dolu. */
function sameShape(a: DocxNode | undefined, b: DocxNode | undefined): boolean {
  if (a?.type !== "paragraph" || b?.type !== "paragraph") return false
  if (!nodeText(a).trim() || !nodeText(b).trim()) return false
  return (a.styleId ?? null) === (b.styleId ?? null) && (a.numbering?.level ?? null) === (b.numbering?.level ?? null)
}

const isHeading = (node: DocxNode | undefined) => node?.type === "paragraph" && sectionHeading(nodeText(node)) !== null

/**
 * Sol sütunun dibinde kalmış bölüm başlığını sağ sütunun ardına taşır.
 *
 * PDF'ten Word'e çevrilmiş CV'lerde iki sütunlu bir beceri listesi şöyle
 * geliyor: sol sütunun maddeleri, bir sonraki bölümün başlığı
 * ("EXPERIENCE"), sütun sonu, sağ sütunun maddeleri. Belge sırasıyla
 * okununca sağ sütundaki beceriler deneyim bloğuna düşüyor ve deneyim
 * çıkarıcısı onları atıyordu.
 *
 * Taşıma yalnızca sağ sütun, sol sütunun maddeleriyle aynı biçimdeyse
 * yapılıyor: sol sütundaki bölüm sağda sürüyor demektir. Sol sütunda eğitim
 * kayıtları, sağda beceri maddeleri varsa başlık sağ sütuna aittir ve
 * yerinde kalır.
 */
export function liftOrphanHeadings<T>(document: T): T {
  const root = document as unknown as DocxNode
  const children = [...(root.children ?? [])]
  for (let i = 1; i < children.length; i++) {
    const heading = children[i - 1]
    if (!startsWithColumnBreak(children[i]!) || !isHeading(heading)) continue

    // Sol sütundaki bölüm: önceki başlıktan bu başlığa kadar, hepsi aynı
    // biçimde. Boş paragraflar (bölüm sınırı, aralık) sayılmıyor.
    let start = i - 1
    while (start > 0 && !isHeading(children[start - 1])) start--
    const left = children.slice(start, i - 1).filter((p) => nodeText(p).trim())
    if (left.length < 2 || !left.every((p) => sameShape(p, left[0]))) continue

    // Sağ sütun: sütun sonuyla başlayan paragraf ve ardından aynı biçimde sürenler.
    let end = i
    while (end < children.length && sameShape(children[end], left[0])) end++
    if (end === i) continue

    children.splice(i - 1, 1)
    children.splice(end - 1, 0, heading!)
  }
  return { ...root, children } as unknown as T
}

/**
 * mammoth'un HTML çıktısını satırlara çevirir; tablo satırlarını korur.
 *
 * Ham metin her hücreyi ayrı satır veriyordu. Tablolu şablonlarda
 * "MS Office | İleri" satırı ikiye bölününce beceri çıkarıcısı "MS Office"u
 * etiket, "İleri"yi beceri sanıyordu. Hücreleri tek paragraf olan satır tek
 * satıra birleşiyor; çok paragraflı hücreler (Europass'taki iş tanımı gibi)
 * satır satır kalıyor.
 */
export function docxHtmlToText(html: string): string {
  const withTables = html.replace(/<table>[\s\S]*?<\/table>/g, (table) => {
    const lines: string[] = []
    for (const [, row] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row!.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
        .map(([, cell]) => paragraphs(cell!))
        .filter((cell) => cell.length > 0)
      if (cells.every((cell) => cell.length === 1)) {
        if (cells.length) lines.push(cells.map((cell) => cell[0]).join(" | "))
      } else {
        for (const cell of cells) lines.push(...cell)
      }
    }
    return lines.map((line) => `<p>${line}</p>`).join("")
  })
  return paragraphs(withTables).join("\n")
}

/** HTML parçasındaki boş olmayan paragraflar, düz metin olarak. */
function paragraphs(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/(p|h[1-6]|li)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}
