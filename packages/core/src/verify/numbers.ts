import type { VerificationIssue } from "../schemas/adaptation.js"

/** Tam sayılar ve ondalıklar; ondalık ayıracı virgül veya nokta olabilir. */
const NUMBER = /\d+(?:[.,]\d+)?/g

/**
 * Ondalık ayıracını tek biçime indirir. Model Türkçe "9,4"ü İngilizce
 * "9.4" diye yazabiliyor; bu yeniden ifadedir, uydurma değil.
 */
function withoutSeparators(num: string): string {
  return num.replace(",", ".")
}

/**
 * Yeniden yazımdaki her sayının kaynakta da bulunup bulunmadığını kontrol
 * eder (spec §7.1).
 *
 * Yalnızca EKLENEN veya DEĞİŞEN sayılar uyarı üretir. Kaynaktaki bir sayıyı
 * düşürmek uydurma değildir — bilgi eksiltmek kullanıcının zaten gördüğü bir
 * değişiklik.
 */
export function checkNumbers(rewritten: string, source: string): VerificationIssue[] {
  const sourceItems = new Set((source.match(NUMBER) ?? []).map(withoutSeparators))
  const newItems = [...new Set(rewritten.match(NUMBER) ?? [])]

  return newItems
    .filter((num) => !sourceItems.has(withoutSeparators(num)))
    .map((num) => ({
      kind: "number_mismatch" as const,
      detail: `Bu maddede "${num}" sayısı geçiyor ama senin yazdığın hâlinde yok.`,
    }))
}

const UNITS: Record<string, number> = { iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 }
const TENS: Record<string, number> = { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90, yüz: 100 }
/** "ikiye katladım", "ona katladık": sayının yönelme hâli. */
const DATIVES: Record<string, number> = { ikiye: 2, üçe: 3, dörde: 4, beşe: 5, altıya: 6, yediye: 7, sekize: 8, dokuza: 9, ona: 10 }

const NOT_LETTER_BEFORE = "(?<![\\p{L}\\d])"
const NOT_LETTER_AFTER = "(?![\\p{L}])"
const NUMBER_WORDS = `(?:(?:${Object.keys(TENS).join("|")})(?:\\s+(?:${Object.keys(UNITS).join("|")}))?|${Object.keys(UNITS).join("|")})`
const KAT = `kat(?:ına|ı|a|lık)?${NOT_LETTER_AFTER}`

/** Yazıyla ölçü: "iki katına", "ikiye katladım", "yarıya", "yüzde elli". */
const WORD_QUANTITY = new RegExp(
  [
    `${NOT_LETTER_BEFORE}(?<times>${NUMBER_WORDS})\\s+${KAT}`,
    `${NOT_LETTER_BEFORE}(?<dative>${Object.keys(DATIVES).join("|")})\\s+katla\\p{L}*`,
    `${NOT_LETTER_BEFORE}(?<half>yarı\\s+yarıya|yarıya)${NOT_LETTER_AFTER}`,
    `${NOT_LETTER_BEFORE}yüzde\\s+(?<percent>${NUMBER_WORDS})${NOT_LETTER_AFTER}`,
  ].join("|"),
  "gu",
)
/** Kaynaktaki aynı ölçünün rakamla yazılışı: "2 katına", "2x", "2'ye katladı", "%50", "yüzde 50". */
const DIGIT_TIMES = new RegExp(`${NOT_LETTER_BEFORE}(\\d+)(?:\\s*${KAT}|\\s*x${NOT_LETTER_AFTER}|'?\\p{L}*\\s+katla)`, "gu")
const DIGIT_PERCENT = /(?:%\s*|yüzde\s*)(\d+)|(\d+)\s*%/gu

function wordsToNumber(words: string): number {
  return words.split(/\s+/).reduce((sum, w) => sum + (TENS[w] ?? UNITS[w] ?? 0), 0)
}

/** Bir metindeki ölçüler, karşılaştırılabilir anahtarlarla: "kat:2", "yüzde:50", "yarı". */
function quantities(text: string): Array<{ key: string; phrase: string }> {
  const found: Array<{ key: string; phrase: string }> = []
  for (const m of text.matchAll(WORD_QUANTITY)) {
    const g = m.groups ?? {}
    const key = g.times
      ? `kat:${wordsToNumber(g.times)}`
      : g.dative
        ? `kat:${DATIVES[g.dative]}`
        : g.half
          ? "yarı"
          : `yüzde:${wordsToNumber(g.percent!)}`
    found.push({ key, phrase: m[0] })
  }
  for (const m of text.matchAll(DIGIT_TIMES)) found.push({ key: `kat:${m[1]}`, phrase: m[0] })
  for (const m of text.matchAll(DIGIT_PERCENT)) found.push({ key: `yüzde:${m[1] ?? m[2]}`, phrase: m[0] })
  return found
}

/** Aynı ölçünün başka yazılışları: yarıya = %50 azalış, iki katı = %100 artış. */
const SAME: Record<string, string[]> = { yarı: ["yüzde:50"], "yüzde:50": ["yarı"], "kat:2": ["yüzde:100"] }

/**
 * Yazıyla yazılmış ölçülerin kaynakta da bulunup bulunmadığı (DOG-166).
 * `checkNumbers` yalnızca rakamları görüyor; "satışları iki katına çıkardım"
 * gözden kaçıyordu. "Bir", tek başına "on" ve "yarı zamanlı" ölçü sayılmıyor:
 * yalnızca kat, yarı ve yüzde kalıpları.
 */
export function checkWordQuantities(rewritten: string, source: string): VerificationIssue[] {
  const known = new Set(quantities(source.toLocaleLowerCase("tr-TR")).map((q) => q.key))
  const seen = new Set<string>()
  return quantities(rewritten.toLocaleLowerCase("tr-TR"))
    .filter((q) => !/\d/.test(q.phrase))
    .filter((q) => !known.has(q.key) && !(SAME[q.key] ?? []).some((k) => known.has(k)))
    .filter((q) => !seen.has(q.key) && seen.add(q.key))
    .map((q) => ({
      kind: "number_mismatch" as const,
      detail: `Bu maddede "${q.phrase}" geçiyor ama senin yazdığın hâlinde yok.`,
    }))
}
