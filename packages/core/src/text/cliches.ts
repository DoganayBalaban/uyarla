import { normalizeText } from "../normalize/turkish.js"

/**
 * Klişe ve olumsuz ifadeler (DOG-89, DOG-96). CV taraması ve ön yazı
 * kontrolü aynı sözlüğü kullanıyor.
 *
 * İşe alımcı "takım oyuncusuyum", "stres altında çalışabilirim" cümlelerini
 * her CV'de okuyor ve bir şey öğrenmiyor; aynı iddiayı bir deneyim örneği
 * taşıyorsa okuyor. Olumsuz kalıplar ("zorunda kaldım", "maalesef") adayı
 * savunmaya geçmiş gösteriyor.
 *
 * Liste dar tutuldu: bir terim olarak da kullanılan kelimeler tek başına
 * yok. "dinamik" değil "dinamik bir ekip": "dinamik fiyatlandırma" bir
 * yetkinlik. Skora katılmıyor; yalnızca öneri.
 *
 * Kalıplar normalizeText biçiminde (küçük harf, "ı" → "i", noktalama yok) ve
 * son kelime ek alabiliyor: "takım oyuncusu" "takım oyuncusuyum"u da buluyor.
 */
export type ClicheKind = "cliche" | "negative"

const CLICHES: string[] = [
  // Türkçe
  "takım oyuncusu",
  "takım çalışmasına yatkın",
  "ekip çalışmasına yatkın",
  "stres altında çalışabil",
  "baskı altında çalışabil",
  "sonuç odaklı",
  "motivasyonu yüksek",
  "kendimi geliştirmeye açık",
  "kendini geliştirmeye açık",
  "öğrenmeye açık",
  "yeniliklere açık",
  "iletişim becerileri güçlü",
  "iletişim becerilerim güçlü",
  "iletişimi güçlü",
  "iletişimi kuvvetli",
  "çok çalışkan",
  "detaylara önem veren",
  "detaycı",
  "hızlı öğrenen",
  "problem çözme yeteneği yüksek",
  "çözüm odaklı",
  "dinamik bir",
  "dinamik ve",
  "genç ve dinamik",
  "kariyer hedeflerim doğrultusunda",
  "sorumluluk sahibi",
  "disiplinli ve",
  "tutkulu",
  // İngilizce
  "team player",
  "hard working",
  "hardworking",
  "detail oriented",
  "results driven",
  "results oriented",
  "self motivated",
  "self starter",
  "go getter",
  "think outside the box",
  "synergy",
  "fast learner",
  "quick learner",
  "excellent communication skills",
  "strong communication skills",
  "passionate about",
  "dynamic team",
]

const NEGATIVE: string[] = [
  "zorunda kaldım",
  "zorunda kaldık",
  "başarısız oldu",
  "maalesef",
  "ne yazık ki",
  "deneyimim olmasa da",
  "deneyimim yok",
  "deneyimim olmamasına",
  "yeterli deneyimim",
  "pek bilgim yok",
  "unfortunately",
  "i lack",
  "although i don t have",
  "although i do not have",
  "i have no experience",
  "was forced to",
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** Baş sınırı var, son sınır yok: Türkçe ek alabilsin. */
const pattern = (phrase: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(normalizeText(phrase))}`, "u")

const ENTRIES: Array<{ phrase: string; kind: ClicheKind; re: RegExp }> = [
  ...CLICHES.map((phrase) => ({ phrase, kind: "cliche" as const, re: pattern(phrase) })),
  ...NEGATIVE.map((phrase) => ({ phrase, kind: "negative" as const, re: pattern(phrase) })),
]

export interface ClicheHit {
  /** Sözlükteki kalıp. */
  phrase: string
  kind: ClicheKind
  /** Kalıbın geçtiği satır ya da cümle, kullanıcıya örnek olarak. */
  line: string
}

/**
 * Metindeki klişe ve olumsuz ifadeler, satır satır. Aynı kalıp bir kez
 * sayılıyor; ilk geçtiği satır örnek.
 */
export function findCliches(text: string): ClicheHit[] {
  const hits: ClicheHit[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/\n|(?<=[.!?])\s+/)) {
    const line = raw.trim()
    if (!line) continue
    const folded = normalizeText(line)
    for (const entry of ENTRIES) {
      if (seen.has(entry.phrase) || !entry.re.test(folded)) continue
      seen.add(entry.phrase)
      hits.push({ phrase: entry.phrase, kind: entry.kind, line })
    }
  }
  return hits
}
