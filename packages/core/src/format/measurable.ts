/**
 * Deneyim bölümündeki ölçülebilir sonuçları sayar (DOG-86).
 *
 * İşe alımcı "satış hedefinin %112'si" ile "satış yaptım" arasındaki farkı
 * ilk okumada görüyor. Uyarlama sayı uyduramaz (verify/numbers.ts); o yüzden
 * eksik sayıyı ancak kullanıcı ekleyebilir. Bu sayaç ona nereye bakacağını
 * söylüyor.
 *
 * Birim cümle, satır değil: CV'lerin bir kısmı deneyimi madde madde değil
 * paragraf olarak yazıyor (değerlendirme setinde cv-f-satis). Yıl ve tarih
 * aralıkları sonuç sayılmıyor; "2022 – Halen" bir başarı değil.
 */

export interface MeasurableResults {
  /** Değerlendirilen deneyim cümlesi sayısı (unvan ve tarih satırları hariç). */
  statements: number
  /** İçinde ölçülebilir bir sonuç geçen cümle sayısı. */
  quantified: number
  /** Sayı içermeyen cümlelerden ilk birkaçı; kullanıcı nereye bakacağını bilsin. */
  examples: string[]
}

/**
 * Bundan kısa parçalar unvan, şirket ya da tarih satırıdır. Noktalı cümle
 * kısa da olabilir; noktasız bir parça ancak uzunsa madde sayılıyor
 * ("Bir Telekom Şirketi — AI Engineer" sayılmasın, noktasız maddeler sayılsın).
 */
const MIN_SENTENCE_WORDS = 3
const MIN_FRAGMENT_WORDS = 8
const EXAMPLE_COUNT = 3

// Tarihler sayıdan önce siliniyor: "03/2022", "2016 – 2020", "Mart 2021".
const DATE = /\b(0?[1-9]|1[0-2])[./](19|20)\d{2}\b|\b(19|20)\d{2}\b/g
// Harfe bitişik rakamlar sonuç değil: "B2", "ISO9001", "S3", "v2". Ayrı duran
// rakam ("60 müşteri", "1,2 milyon", "3x"), yüzde ve para işareti sonuçtur.
const QUANTITY = /(?<![\p{L}\d.,])\d+(?:[.,]\d+)?(?:x\b|(?!\p{L}))|%|₺|\$|€/u

/** Cümlede ölçülebilir bir sonuç (sayı, yüzde, para) var mı; tarihler sayılmıyor. */
export function hasQuantity(statement: string): boolean {
  return QUANTITY.test(statement.replace(DATE, " "))
}

export function measurableResults(experienceBlock: string): MeasurableResults {
  const statements = splitStatements(experienceBlock)
  const missing: string[] = []
  let quantified = 0

  for (const statement of statements) {
    if (QUANTITY.test(statement.replace(DATE, " "))) quantified++
    else missing.push(statement)
  }

  return { statements: statements.length, quantified, examples: missing.slice(0, EXAMPLE_COUNT) }
}

function splitStatements(block: string): string[] {
  const out: string[] = []
  for (const line of joinWrappedLines(block.split("\n"))) {
    // Madde işaretleri ve tablo ayıracı ("Tarih | Pozisyon") cümle sınırı.
    const clean = line.replace(/^[\s•●▪◦\-–*·]+/, "")
    for (const part of clean.split(/(?<=[.!?;])\s+(?=\p{Lu})|\s\|\s/u)) {
      const statement = part.trim()
      // İletişim satırı bölümlemeden deneyime sızabiliyor (cv-g-ik).
      if (statement.includes("@")) continue
      // "—", "–" ve "(03/2022" kelime değil; unvan satırını uzun göstermesin.
      const words = statement.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length
      const sentence = /[.!?;]$/.test(statement)
      if (words >= (sentence ? MIN_SENTENCE_WORDS : MIN_FRAGMENT_WORDS)) out.push(statement)
    }
  }
  return out
}

/**
 * PDF'ten gelen metinde uzun madde satır sonunda bölünüyor ("…aylık 1,2
 * milyon TL" / "bütçeyle yönettim."). Küçük harfle başlayan satır, noktalamayla
 * bitmeyen bir önceki satırın devamıdır.
 */
function joinWrappedLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const previous = out.at(-1)
    if (previous !== undefined && /^\s*\p{Ll}/u.test(line) && !/[.!?;:]\s*$/.test(previous)) {
      out[out.length - 1] = `${previous.trimEnd()} ${line.trim()}`
    } else {
      out.push(line)
    }
  }
  return out
}
