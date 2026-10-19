/**
 * Olumsuzlanan yan cümleler (DOG-122). Ön yazı eksik bir gereksinime dürüst
 * bir köprü kurabiliyor: "Perkotek programını kullanmadım; ancak PDKS
 * üzerinden puantaj kontrol ettim." Uydurma kontrolü CV'de olmayan her ilan
 * terimini işaretliyordu; bu cümle de "CV'nde yok" uyarısı alıyordu, oysa
 * dürüst olan tam da o.
 *
 * Bu fonksiyon olumsuzlanan kısmı metinden çıkarıyor; kontrol geri kalanına
 * bakıyor. Sınırlar dar tutuldu: bağlaçtan sonraki iddia ("ancak Kubernetes
 * ile çalıştım") yine kontrol ediliyor.
 *
 *   - Yan cümle sınırı: cümle sonu, noktalı virgül, karşıtlık bağlacı ve
 *     Türkçe çekimli fiilden sonra gelen virgül ("kurdum,").
 *   - Olumsuz yan cümlede baştan olumsuzluktan sonraki ilk virgüle kadar
 *     çıkarılıyor: Türkçede olumsuz fiil sonda ("X, Y ve Z ile çalışmadım"),
 *     İngilizcede başta ("I have not worked on GCP, but …").
 *   - "doğrudan" olumsuzluk değil ("doğrudan yönettim").
 */
const NEGATION =
  /(değil|yok\b|olmadı|olmamakla|olmamasına|olmasa da|bulunmamakta|bulunmuyor|bulunmamaktadır|çalışmadım|kullanmadım|yapmadım|edinmedim|sahip değil|have not|haven't|has not|hasn't|did not|didn't|do not have|don't have|no direct|not worked|not used)/i

const CONNECTOR = /\s*(?:;|\b(?:ancak|ama|fakat|lakin|buna karşın|yine de|but|however|yet)\b)\s*/i

/** Türkçe çekimli fiil sonu: "kurdum", "yapıyorum", "geliştirdim", "-dır". */
const FINITE_VERB = /(?:[dt][ıiuü]m|yorum|[dt][ıiuü]r|mektedir|maktadır|[dt][ıiuü]k)$/i

function clauses(sentence: string): string[] {
  const out: string[] = []
  for (const part of sentence.split(CONNECTOR)) {
    let current = ""
    for (const piece of part.split(/(?<=,)/)) {
      current += piece
      const lastWord = current.replace(/,\s*$/, "").trim().split(/\s+/).at(-1) ?? ""
      if (piece.endsWith(",") && FINITE_VERB.test(lastWord)) {
        out.push(current)
        current = ""
      }
    }
    if (current.trim()) out.push(current)
  }
  return out
}

/** Metnin olumsuzlanmayan kısmı; uydurma kontrolü buna bakıyor. */
export function withoutNegatedClauses(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .flatMap(clauses)
    .map((clause) => {
      const match = NEGATION.exec(clause)
      if (!match) return clause
      const after = clause.indexOf(",", match.index + match[0].length)
      return after === -1 ? "" : clause.slice(after + 1)
    })
    .join(" ")
}
