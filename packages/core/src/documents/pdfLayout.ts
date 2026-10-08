/** pdfjs metin öğesinin bize gereken kısmı; koordinatlar PDF birimi, y yukarı doğru artar. */
export interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * Sütun boşluğu sayfanın bu aralığında aranıyor; kenar boşlukları sütun değil.
 * Dar kenar sütunlu şablonlarda boşluk ~%24'te (cv-c), aralık bu yüzden geniş.
 */
const GUTTER_RANGE = [0.15, 0.85] as const
/** Boşluğu kesen öğelerin toplam metne oranı en fazla bu kadar olabilir (başlık, ad satırı). */
const MAX_SPANNING_SHARE = 0.1
/**
 * İki taraf da metnin en az bu kadarını taşımalı: sağa yaslı tarihler sütun
 * değil. Kenar sütunu az metin taşıyabildiği için oran düşük; asıl eleme,
 * sayfa boyunca uzanan satırların boşluğu kesmesi (MAX_SPANNING_SHARE).
 */
const MIN_COLUMN_SHARE = 0.1
const MIN_LINES_PER_COLUMN = 4
/** Boşluk en az bu genişlikte boş kalmalı (pt). */
const MIN_GUTTER_WIDTH = 8

/**
 * İki sütunlu bir sayfanın metnini sütun sütun okur (DOG-31).
 *
 * pdf-parse metni içerik akışının sırasıyla veriyor. İki sütunlu şablonlarda
 * bu sıra iki sütunu iç içe geçiriyor: "HAKKIMDA" başlığının ardından sağ
 * sütunun "PROFESYONEL DENEYİM" başlığı geliyor ve hakkımda metni deneyim
 * bloğuna düşüyordu.
 *
 * Sütun bulunamazsa null: çağıran pdf-parse'ın metnini olduğu gibi kullanıyor.
 * Tek sütunlu bir belgeyi yanlışlıkla bölmek, iki sütunlu bir belgeyi bölmemekten
 * zararlı; eşikler bu yüzden temkinli.
 */
export function orderColumns(items: TextItem[], pageWidth: number): string | null {
  const textItems = items.filter((i) => i.str.trim())
  const totalChars = textItems.reduce((n, i) => n + i.str.length, 0)
  if (totalChars === 0) return null

  // Sağ kenar boşluğu da "boş şerit"; iki yanında yeterli metin olan en geniş şerit seçiliyor.
  const split = findGutters(textItems, pageWidth, totalChars)
    .map((gutter) => splitAt(textItems, gutter))
    .find(
      (c) =>
        c.leftLines.length >= MIN_LINES_PER_COLUMN &&
        c.rightLines.length >= MIN_LINES_PER_COLUMN &&
        c.leftChars >= totalChars * MIN_COLUMN_SHARE &&
        c.rightChars >= totalChars * MIN_COLUMN_SHARE,
    )
  if (!split) return null
  const { spanning, leftLines, rightLines } = split

  // Boşluğu kesen satırlar (sayfa başlığı gibi) bölgeleri ayırıyor: her
  // satırın üstünde kalan sol ve sağ sütun önce okunuyor, sonra satırın kendisi.
  const out: string[] = []
  let leftQueue = leftLines
  let rightQueue = rightLines
  for (const band of toLines(spanning)) {
    out.push(...leftQueue.filter((l) => l.y > band.y).map((l) => l.text))
    out.push(...rightQueue.filter((l) => l.y > band.y).map((l) => l.text))
    out.push(band.text)
    leftQueue = leftQueue.filter((l) => l.y <= band.y)
    rightQueue = rightQueue.filter((l) => l.y <= band.y)
  }
  out.push(...leftQueue.map((l) => l.text), ...rightQueue.map((l) => l.text))
  return out.join("\n")
}

function splitAt(items: TextItem[], gutter: number) {
  const left = items.filter((i) => !crosses(i, gutter) && i.x + i.width <= gutter)
  const right = items.filter((i) => !crosses(i, gutter) && i.x >= gutter)
  return {
    spanning: items.filter((i) => crosses(i, gutter)),
    leftLines: toLines(left),
    rightLines: toLines(right),
    leftChars: left.reduce((n, i) => n + i.str.length, 0),
    rightChars: right.reduce((n, i) => n + i.str.length, 0),
  }
}

function crosses(item: TextItem, x: number): boolean {
  return item.x < x && item.x + item.width > x
}

/**
 * Boşluğu kesen metnin en az olduğu x değerlerinin kesintisiz aralıkları,
 * genişten dara; her aralık için orta nokta. Kesen metin çoksa sütun yok.
 */
function findGutters(items: TextItem[], pageWidth: number, totalChars: number): number[] {
  const from = Math.floor(pageWidth * GUTTER_RANGE[0])
  const to = Math.ceil(pageWidth * GUTTER_RANGE[1])

  let best = Infinity
  const crossingAt = new Map<number, number>()
  for (let x = from; x <= to; x++) {
    const chars = items.filter((i) => crosses(i, x)).reduce((n, i) => n + i.str.length, 0)
    crossingAt.set(x, chars)
    best = Math.min(best, chars)
  }
  if (best > totalChars * MAX_SPANNING_SHARE) return []

  const runs: Array<[number, number]> = []
  let runStart = -1
  for (let x = from; x <= to + 1; x++) {
    if (x <= to && crossingAt.get(x) === best) {
      if (runStart < 0) runStart = x
    } else if (runStart >= 0) {
      if (x - runStart >= MIN_GUTTER_WIDTH) runs.push([runStart, x])
      runStart = -1
    }
  }
  return runs.sort((a, b) => b[1] - b[0] - (a[1] - a[0])).map(([start, end]) => (start + end) / 2)
}

/** Aynı yükseklikteki öğeleri satıra topluyor; satırlar yukarıdan aşağıya. */
function toLines(items: TextItem[]): Array<{ y: number; text: string }> {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Array<{ y: number; items: TextItem[] }> = []
  for (const item of sorted) {
    const current = lines.at(-1)
    if (current && Math.abs(current.y - item.y) <= Math.max(item.height, 1) / 2) {
      current.items.push(item)
    } else {
      lines.push({ y: item.y, items: [item] })
    }
  }

  return lines.map(({ y, items: lineItems }) => {
    const ordered = lineItems.sort((a, b) => a.x - b.x)
    let text = ""
    let end = -Infinity
    for (const item of ordered) {
      // pdfjs kelimeleri bazen ayrı öğe veriyor, aradaki boşluğu yazmıyor.
      if (text && item.x - end > 1 && !text.endsWith(" ") && !item.str.startsWith(" ")) text += " "
      text += item.str
      end = item.x + item.width
    }
    return { y, text: text.replace(/\s+/g, " ").trim() }
  })
}
