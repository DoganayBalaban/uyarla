/**
 * Deneyim süresi şartı (DOG-75).
 *
 * "En az 2 yıl yazılım test deneyimi" kavramı ("yazılım test") CV'de geçtiği
 * için karşılanmış sayılıyordu; adayın ~1,5 yılı vardı. Süre kavram değil,
 * kelime ya da anlam eşleşmesiyle bulunamaz: CV'deki tarih aralıklarından
 * hesaplanıyor.
 *
 * Ay, `yıl * 12 + (ay - 1)` olarak tek bir tam sayı: aralık hesabı çıkarma.
 */

/** Gereksinimin istediği en az yıl; süre istenmiyorsa null. "2-3 yıl" → 2. */
export function requiredYears(text: string): number | null {
  const match = text.match(
    /(?<![\d.,])(\d{1,2})(?:[.,]\d)?\s*\+?\s*(?:[-–]\s*\d{1,2}\s*)?(?:yıl|years?|yrs?)/iu,
  )
  if (!match) return null
  const years = Number(match[1])
  return years > 0 && years <= 40 ? years : null
}

const PRESENT = /\b(halen|hâlen|hala|hâlâ|present|current|now|ongoing|günümüz|devam|şu an)/iu

/** Ay adlarının ilk üç harfi; Türkçe ve İngilizce. */
const MONTHS: Record<string, number> = {
  oca: 1, şub: 2, sub: 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, ağu: 8, agu: 8, eyl: 9, eki: 10, kas: 11, ara: 12,
  jan: 1, feb: 2, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** CV'deki bir tarihi aya çevirir; okunamazsa null. */
export function parseMonth(raw: string, now: Date): number | null {
  const text = raw.trim().toLocaleLowerCase("tr")
  if (!text) return null
  if (PRESENT.test(text)) return now.getUTCFullYear() * 12 + now.getUTCMonth()

  const at = (year: number, month: number) =>
    month >= 1 && month <= 12 && year >= 1950 && year <= 2100 ? year * 12 + (month - 1) : null

  let found = text.match(/\b(\d{1,2})\s*[/.-]\s*((?:19|20)\d{2})\b/)
  if (found) return at(Number(found[2]), Number(found[1]))
  found = text.match(/\b((?:19|20)\d{2})\s*[/.-]\s*(\d{1,2})\b/)
  if (found) return at(Number(found[1]), Number(found[2]))

  const year = text.match(/(?:19|20)\d{2}/)
  if (!year) return null
  const name = text.match(/\p{L}{3,}/u)?.[0]?.slice(0, 3)
  const month = name ? MONTHS[name] : undefined
  // Yalnız yıl yazılmışsa ortası (Temmuz): başı ya da sonu seçmek süreyi
  // olduğundan uzun gösterip şartı karşılanmış sayabilirdi.
  return at(Number(year[0]), month ?? 7)
}

/**
 * Rollerin toplam süresi, ay olarak. Çakışan aralıklar bir kez sayılıyor
 * (aynı dönemde iki iş, iki kat deneyim değil). Hiçbir rolün tarihi
 * okunamıyorsa null: karar verilemiyor.
 */
export function experienceMonths(
  roles: Array<{ startDate: string; endDate: string }>,
  now: Date,
): number | null {
  const ranges = roles
    .map((r) => [parseMonth(r.startDate, now), parseMonth(r.endDate, now)] as const)
    .filter((r): r is readonly [number, number] => r[0] !== null && r[1] !== null && r[1] >= r[0])
    .sort((a, b) => a[0] - b[0])
  if (ranges.length === 0) return null

  let total = 0
  let [start, end] = ranges[0]!
  for (const [s, e] of ranges.slice(1)) {
    if (s <= end + 1) {
      end = Math.max(end, e)
    } else {
      total += end - start + 1
      ;[start, end] = [s, e]
    }
  }
  return total + (end - start + 1)
}
