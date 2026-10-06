import { containsKeyword, normalizeText } from "../normalize/turkish.js"
import type { JobPostingData } from "../schemas/job.js"

/**
 * Yeniden yazımın kaynaktaki bilgiyi koruyup korumadığı (K-38).
 *
 * Uydurma kontrolleri yazıma EKLENENE bakıyor; bu kontrol KAYBOLANA bakıyor.
 * Uçtan uca testte model "sayfa yüklenme süresini %40 azalttım"ı
 * "web performansı %40 azalttım"a çevirdi: sayı korunduğu için sayı
 * kontrolü geçti, ama anlam tersine döndü ve özgün ifade silindi. Özet
 * yazımı da "4 yıllık deneyime sahip frontend geliştiriciyim" cümlesini
 * düşürdü.
 *
 * Üç koşul:
 *   1. Terim uyumunun dayanağı yazımda duruyor: terim ifadenin yanına
 *      eklenir, yerine geçmez.
 *   2. Kaynakta geçen ilan kavramları yazımda da geçiyor (birikmiş işler #10).
 *   3. Kaynaktaki sayılar yazımda da geçiyor.
 */
export function preservesSource(input: {
  rewritten: string
  source: string
  posting: JobPostingData
  /** Terim uyumlarının dayanakları. */
  bases?: readonly string[]
}): { ok: true } | { ok: false; reason: string } {
  for (const basisText of input.bases ?? []) {
    if (!basisPreserved(input.rewritten, basisText)) {
      return { ok: false, reason: `dayanak kayboldu: ${basisText}` }
    }
  }

  for (const conceptItem of input.posting.requirements.flatMap((r) => r.concepts)) {
    const members = [conceptItem.term, ...conceptItem.synonyms]
    const inSource = members.some((t) => containsKeyword(input.source, t))
    if (inSource && !members.some((t) => containsKeyword(input.rewritten, t))) {
      return { ok: false, reason: `ilan kavramı kayboldu: ${conceptItem.term}` }
    }
  }

  const rewriteNumbers = new Set(nums(input.rewritten))
  for (const num of nums(input.source)) {
    if (!rewriteNumbers.has(num)) return { ok: false, reason: `sayı kayboldu: ${num}` }
  }

  return { ok: true }
}

/**
 * Dayanak yazımda duruyor mu. Son kelime geçmiş zaman fiiliyse ("teknik
 * destek sağladım") aynı kökten olumlu bir çekimi de kabul ediliyor: terimi
 * eklemek için cümleyi uzatan model fiili bağlaca çeviriyor ("teknik destek
 * sağlayarak …"). Anlam korunuyor ama kelime eşleşmesi bunu kayıp sayıyordu;
 * Türkçe CV'de yazımların çoğu bu yüzden atılıyordu (eval:adapt, cv-c).
 *
 * Kök değişirse ("yönettim" → "sağladım") ya da fiil olumsuzlanırsa
 * ("sağlamadım") dayanak kaybolmuş sayılıyor.
 */
function basisPreserved(rewriteText: string, basisText: string): boolean {
  if (containsKeyword(rewriteText, basisText)) return true

  const previous = normalizeText(basisText).split(" ")
  const stem = verbStem(previous.pop() ?? "")
  if (!stem) return false

  const words = normalizeText(rewriteText).split(" ")
  for (let i = previous.length; i < words.length; i++) {
    const word = words[i]!
    if (!word.startsWith(stem) || /^m[ae]/.test(word.slice(stem.length))) continue
    if (words.slice(i - previous.length, i).join(" ") === previous.join(" ")) return true
  }
  return false
}

/** Birinci şahıs geçmiş zaman fiilinin kökü: "sağladım" → "sağla". */
function verbStem(word: string): string | null {
  const termMatch = /^(.{3,}?)[dt][iuü][mk]$/.exec(word)
  return termMatch ? termMatch[1]! : null
}

function nums(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)*/g) ?? []
}

/**
 * Özet yazımında korunması gereken terimler: profilin becerilerinden özgün
 * özette geçenler. `preservesSource`'a `bases` olarak veriliyor.
 *
 * Neden: ilan kavramı kontrolü yalnızca ilanın aradığı terimleri koruyor.
 * gpt-4.1-mini özeti "genel" bir metne çevirip ilanın adıyla aramadığı
 * ama anlamca eşleşen terimleri (RAG, MCP, tool calling…) atabiliyor; özet
 * zayıflıyor ve gömme eşleşmesi düşüyor (6 Ekim 2026: skor 47 → 45).
 */
export function summaryAnchors(summary: string, skills: readonly string[]): string[] {
  return [...new Set(skills.filter((skill) => skill.trim() && containsKeyword(summary, skill)))]
}
