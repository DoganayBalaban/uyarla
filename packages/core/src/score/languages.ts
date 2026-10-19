import { normalizeText } from "../normalize/turkish.js"
import type { Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"

/**
 * Dil seviyesi kapısı (DOG-115).
 *
 * Dil gereksinimi kelime eşleşmesiyle karşılanıyor: ilan "akıcı İngilizce
 * (C1)" istiyor, CV'de "İngilizce (B1)" var, gereksinim "karşılandı"
 * görünüyor. Skor bunu ayırt etmiyor ve etmemeli de (seviye beyanı kesin
 * değil); ama kullanıcı ilanın istediği seviyenin altında olduğunu görmeli.
 * Kontrol yalnızca ilan bir seviye söylediğinde yapılıyor.
 */
export interface LanguageCheck {
  /** Gereksinimin `requirements` içindeki sırası. */
  index: number
  language: string
  /** İlanın istediği seviye, CEFR karşılığıyla ("C1"). */
  required: string
  /** CV'deki satır ("İngilizce (B1)"); yoksa null. */
  cvLine: string | null
  /** CV satırındaki seviye, CEFR karşılığıyla; yazmıyorsa null. */
  found: string | null
  /** ok: istenen seviyede ya da üstünde; below: altında; unknown: CV seviye söylemiyor; absent: dil CV'de yok. */
  status: "ok" | "below" | "unknown" | "absent"
}

/**
 * Kalıplar normalizeText biçiminde: küçük harf, "ı" → "i", noktalama boşluk.
 * Böylece "İyi derecede İngilizce" ve "FLUENT ENGLISH" aynı kalıba düşüyor;
 * JavaScript'in `i` bayrağı "İ"yi "i" saymıyor.
 */
const LANGUAGES: Array<{ name: string; pattern: RegExp }> = [
  { name: "İngilizce", pattern: /ingilizce|english/ },
  { name: "Almanca", pattern: /almanca|german(?!y)|deutsch/ },
  { name: "Fransızca", pattern: /fransizca|french|fran[cç]ais/ },
  { name: "İspanyolca", pattern: /ispanyolca|spanish|espa[nñ]ol/ },
  { name: "İtalyanca", pattern: /italyanca|italian/ },
  { name: "Rusça", pattern: /rusça|russian/ },
  { name: "Arapça", pattern: /arapça|arabic/ },
  { name: "Çince", pattern: /çince|chinese|mandarin/ },
  { name: "Japonca", pattern: /japonca|japanese/ },
  { name: "Korece", pattern: /korece|korean/ },
  { name: "Felemenkçe", pattern: /felemenkçe|hollandaca|dutch/ },
  { name: "Portekizce", pattern: /portekizce|portuguese/ },
  { name: "Türkçe", pattern: /türkçe|turkish/ },
]

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const

/** Kelime sınırı: "iyi" "iyileştirme"nin, "orta" "ortam"ın içinde eşleşmesin. */
const word = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "u")

/**
 * Seviye ifadeleri, CEFR basamağıyla (1 = A1 … 6 = C2). Sıra önemli: uzun
 * ifade kısasından önce ("çok iyi" "iyi"den, "upper intermediate"
 * "intermediate"ten, "full professional" "professional working"den).
 * LinkedIn'in beş basamağı da burada: Elementary, Limited working,
 * Professional working, Full professional, Native or bilingual.
 */
const LEVEL_WORDS: Array<[RegExp, number]> = [
  [word("ana ?dil\\w*|native|bilingual|mother tongue"), 6],
  [word("full professional"), 5],
  [word("professional working"), 4],
  [word("limited working"), 3],
  [word("upper intermediate"), 4],
  [word("pre intermediate"), 2],
  [word("çok iyi|ileri|advanced|akici|fluent|fluency|excellent|proficient|proficiency"), 5],
  [word("iyi|good|strong"), 4],
  [word("orta|intermediate|working knowledge|working proficiency"), 3],
  [word("başlangiç|temel|beginner|elementary|basic"), 2],
]

const CEFR_CODE = word("([abc]) ?([12])")

function parseLevel(text: string): number | null {
  const folded = normalizeText(text)
  const cefr = folded.match(CEFR_CODE)
  if (cefr) return CEFR.indexOf(`${cefr[1]!.toUpperCase()}${cefr[2]}` as (typeof CEFR)[number]) + 1
  for (const [pattern, level] of LEVEL_WORDS) if (pattern.test(folded)) return level
  return null
}

function mentionedLanguages(text: string) {
  const folded = normalizeText(text)
  return LANGUAGES.filter((l) => l.pattern.test(folded))
}

export function checkLanguages(requirements: Requirement[], profile: ResumeProfile): LanguageCheck[] {
  const checks: LanguageCheck[] = []
  // Dil satırı çoğunlukla Diller bölümünde; bazı CV'ler beceri listesine yazıyor.
  const cvLines = [...profile.languages, ...profile.skills]
  for (const [index, requirement] of requirements.entries()) {
    if (requirement.type === "condition" || requirement.type === "soft") continue
    const languages = mentionedLanguages(requirement.text)
    // Birden çok dil tek gereksinimdeyse ("İngilizce C1, Almanca artı")
    // seviyenin hangisine ait olduğu belli değil.
    if (languages.length !== 1) continue
    const required = parseLevel(requirement.text)
    if (required === null) continue
    const language = languages[0]!
    const cvLine = cvLines.find((line) => language.pattern.test(normalizeText(line))) ?? null
    const found = cvLine ? parseLevel(cvLine) : null
    checks.push({
      index,
      language: language.name,
      required: CEFR[required - 1]!,
      cvLine,
      found: found === null ? null : CEFR[found - 1]!,
      status: cvLine === null ? "absent" : found === null ? "unknown" : found >= required ? "ok" : "below",
    })
  }
  return checks
}
