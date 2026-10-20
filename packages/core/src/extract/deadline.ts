import { normalizeText } from "../normalize/turkish.js"

/**
 * Son başvuru tarihi (DOG-120). Model ilandaki ifadeyi olduğu gibi
 * kopyalıyor ("Son başvuru: 25 Ekim 2026"); tarihe çevirmek burada,
 * deterministik. Tahmin yok: "en kısa sürede", "acil", "2 hafta içinde"
 * bir tarih değil, null.
 *
 * Yıl yazmayan tarih ("25 Ekim") çıkarım anına göre yerleştiriliyor: bu
 * yılın o günü, ama 60 günden daha eskiyse gelecek yılın. Aralık'ta okunan
 * "15 Ocak" gelecek yıl; Kasım başında okunan "25 Ekim" bu yıl, yani
 * geçmiş (süresi dolmuş ilan).
 */
const MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, şubat: 2, mart: 3, nisan: 4, mayis: 5, mayıs: 5, haziran: 6, temmuz: 7,
  agustos: 8, ağustos: 8, eylul: 9, eylül: 9, ekim: 10, kasim: 11, kasım: 11, aralik: 12, aralık: 12,
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
}

const NEXT_YEAR_AFTER_DAYS = 60
const DAY_MS = 864e5

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  // 31 Şubat gibi geçersiz günler bir sonraki aya taşar; reddediliyor.
  if (date.getUTCMonth() !== month - 1) return null
  return date.toISOString().slice(0, 10)
}

function withYear(month: number, day: number, year: number | null, now: Date): string | null {
  if (year !== null) return iso(year < 100 ? 2000 + year : year, month, day)
  const thisYear = iso(now.getUTCFullYear(), month, day)
  if (!thisYear) return null
  const tooOld = Date.parse(thisYear) < now.getTime() - NEXT_YEAR_AFTER_DAYS * DAY_MS
  return tooOld ? iso(now.getUTCFullYear() + 1, month, day) : thisYear
}

const monthWord = (word: string): number | undefined =>
  MONTHS[word] ?? MONTHS[normalizeText(word)] ?? MONTHS[word.replace(/[^\p{L}]/gu, "")]

/** İlandaki son başvuru ifadesinden `YYYY-MM-DD`; açık bir tarih yoksa null. */
export function parseDeadline(text: string | null | undefined, now: Date = new Date()): string | null {
  if (!text?.trim()) return null
  const lower = text.toLocaleLowerCase("tr")

  // 2026-10-25
  let m = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))

  // 25.10.2026, 25/10/2026, 25-10-26
  m = lower.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})\b/)
  if (m) return withYear(Number(m[2]), Number(m[1]), Number(m[3]), now)

  // 25 Ekim 2026, 25 Ekim'e kadar, 25 October 2026
  m = lower.match(/\b(\d{1,2})\s+([\p{L}]+)(?:['’]?[\p{L}]*)?(?:\s+(\d{4}))?/u)
  if (m) {
    const month = monthWord(m[2]!)
    if (month) return withYear(month, Number(m[1]), m[3] ? Number(m[3]) : null, now)
  }

  // October 25, 2026 · Oct 25
  m = lower.match(/\b([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/)
  if (m) {
    const month = monthWord(m[1]!)
    if (month) return withYear(month, Number(m[2]), m[3] ? Number(m[3]) : null, now)
  }
  return null
}
