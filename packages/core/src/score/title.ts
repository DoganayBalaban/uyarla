import { normalizeTokens } from "../normalize/turkish.js"
import type { ResumeProfile } from "../schemas/resume.js"

/**
 * İlandaki unvan CV'de geçiyor mu (DOG-87).
 *
 * İşe alımcılar ATS'de çoğu zaman unvanla arıyor; "Muhasebe Uzmanı" ilanına
 * başvuran CV'nin başlığında ya da bir deneyiminde bu unvan yoksa aramada
 * görünmeyebilir. Skora katılmıyor: unvan eşleşmesi bir uygunluk ölçüsü değil,
 * bulunabilirlik ipucu.
 *
 * Kelime düzeyinde ve sözlükle (normalizeTokens): "Software Engineer" ile
 * "Yazılım Mühendisi" aynı köklere iniyor. Kıdem sözcükleri karşılaştırmadan
 * çıkarılıyor; "Senior Frontend Developer" ilanına "Frontend Developer"
 * unvanı yeterli. Kıdemi süre kontrolü (score/duration.ts) ayrıca ölçüyor.
 */

export type TitleMatchLevel = "exact" | "partial" | "none"

export interface TitleMatch {
  /** İlandaki unvan, kullanıcıya olduğu gibi gösteriliyor. */
  position: string
  level: TitleMatchLevel
  /** Eşleşen CV unvanı (başlık ya da deneyim); "none" ise null. */
  resumeTitle: string | null
}

/** Normalleştirilmiş (normalizeTokens) kıdem ve kipleme sözcükleri. */
const NOISE = new Set(
  [
    "senior", "sr", "junior", "jr", "kidemli", "mid", "level", "i", "ii", "iii",
    "intern", "stajyer", "remote", "uzaktan", "hybrid", "hibrit", "tam", "zamanli", "full", "time",
    "m", "f", "d", "w", "k", "e",
  ].flatMap((w) => normalizeTokens(w)),
)

export function titleMatch(position: string, profile: ResumeProfile): TitleMatch | null {
  // LLM bazen iki unvanı birlikte yazıyor: "Yapay Zeka Mühendisi / Yapay Zeka
  // Geliştiricisi". Herhangi biri yeterli.
  const alternatives = position
    .split(/\s\/\s/)
    .map(coreTokens)
    .filter((t) => t.length > 0)
  if (alternatives.length === 0) return null

  let best: TitleMatch = { position, level: "none", resumeTitle: null }
  for (const title of resumeTitles(profile)) {
    const have = new Set(coreTokens(title))
    for (const wanted of alternatives) {
      if (wanted.every((t) => have.has(t))) return { position, level: "exact", resumeTitle: title }
      // Yakın unvan: rol sözcüğü (Türkçede de İngilizcede de son kelime:
      // "uzman", "mühendis", "specialist") ve kelimelerin yarısından fazlası
      // tutuyor. "Digital Marketing Specialist" ilanına "Performance Marketing
      // Specialist" yakın; "İnsan Kaynakları Uzmanı" ilanına "Muhasebe
      // Uzmanı" değil, ortak olan yalnızca rol sözcüğü.
      const shared = wanted.filter((t) => have.has(t)).length
      if (best.level === "none" && have.has(wanted.at(-1)!) && shared * 2 > wanted.length) {
        best = { position, level: "partial", resumeTitle: title }
      }
    }
  }
  return best
}

/**
 * CV'deki unvanlar: başlık satırı ve deneyim unvanları. Başlık satırında
 * çoğu zaman konum ve iletişim de var ("Satış Mühendisi · Pendik, İstanbul ·
 * mert@…"); ayraçlardan bölünüp yalnızca unvan olabilecek kısa parçalar
 * alınıyor.
 */
function resumeTitles(profile: ResumeProfile): string[] {
  const headline = (profile.headline ?? "")
    .split(/\s*[·|•]\s*/)
    .map((p) => p.trim())
    .filter((p) => p && !p.includes("@") && p.split(/\s+/).length <= MAX_TITLE_WORDS)
  const titles = profile.experience.map((e) => e.title.trim()).filter(Boolean)
  return [...headline, ...titles]
}

const MAX_TITLE_WORDS = 6

/** Unvanın karşılaştırılan kelimeleri: kıdem ve parantez içi çıkarılmış (ön yazı kontrolü de kullanıyor). */
export function coreTokens(title: string): string[] {
  // Parantez içi çoğunlukla çalışma biçimi, cinsiyet eki ya da LLM notu:
  // "(Remote)", "(m/w/d)", "(implied)".
  return normalizeTokens(title.replace(/\([^)]*\)/g, " ")).filter((t) => !NOISE.has(t))
}
