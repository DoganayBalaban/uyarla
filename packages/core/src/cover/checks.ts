import { normalizeTokens } from "../normalize/turkish.js"
import type { JobPostingData } from "../schemas/job.js"
import { coreTokens } from "../score/title.js"
import { findCliches, type ClicheHit } from "../text/cliches.js"

/**
 * Ön yazı kontrol listesi (DOG-96). Deterministik; skoru etkilemiyor, ön
 * yazının altında öneri olarak gösteriliyor. Değerlendirme betiği de aynı
 * kontrolleri kullanıyor.
 *
 * İletişim bilgisi kontrolü yok: üretilen metin bilinçli olarak hitap ve imza
 * içermiyor (COVER_LETTER_PROMPT); iletişim bilgisi gönderilen e-postanın ya
 * da belgenin işi.
 */
export interface CoverLetterChecks {
  /** İlanın şirket adı geçiyor mu; ilanda şirket yoksa null. */
  company: { name: string; mentioned: boolean } | null
  /** İlanın unvanı geçiyor mu (unvan bulgusuyla aynı kural: kıdem sözcükleri sayılmıyor). */
  title: { position: string; mentioned: boolean } | null
  words: number
  /** Önerilen aralık dışında mı. */
  length: "short" | "ok" | "long"
  cliches: ClicheHit[]
}

/** Önerilen uzunluk; istem 150–250 kelime istiyor, kontrol biraz pay bırakıyor. */
export const LETTER_MIN_WORDS = 120
export const LETTER_MAX_WORDS = 300

/** Şirket adındaki tüzel ekler: ön yazıda "Acme Teknoloji" yeterli, "A.Ş." gerekmiyor. */
const LEGAL = new Set(
  ["a", "ş", "aş", "ltd", "şti", "limited", "şirketi", "inc", "llc", "gmbh", "corp", "co", "holding", "san", "tic", "ve"].flatMap(
    (w) => normalizeTokens(w),
  ),
)

function companyTokens(company: string): string[] {
  return normalizeTokens(company).filter((t) => t.length > 1 && !LEGAL.has(t))
}

export function checkCoverLetter(
  paragraphs: string[],
  posting: Pick<JobPostingData, "company" | "position">,
): CoverLetterChecks {
  const text = paragraphs.join("\n\n")
  const tokens = new Set(normalizeTokens(text))
  const words = text.split(/\s+/).filter(Boolean).length

  const companyWanted = posting.company ? companyTokens(posting.company) : []
  // İlk kelime çoğunlukla şirketin asıl adı: "Acme Teknoloji A.Ş." için "Acme".
  const company =
    posting.company && companyWanted.length > 0
      ? { name: posting.company, mentioned: tokens.has(companyWanted[0]!) }
      : null

  const alternatives = posting.position
    .split(/\s\/\s/)
    .map(coreTokens)
    .filter((t) => t.length > 0)
  const title =
    alternatives.length > 0
      ? {
          position: posting.position,
          // Rol sözcüğü ve kelimelerin yarısından fazlası: "Kıdemli Backend
          // Geliştirici" ilanına "backend geliştirici pozisyonu" yeter.
          mentioned: alternatives.some((w) => {
            const shared = w.filter((t) => tokens.has(t)).length
            return tokens.has(w.at(-1)!) && shared * 2 > w.length
          }),
        }
      : null

  return {
    company,
    title,
    words,
    length: words < LETTER_MIN_WORDS ? "short" : words > LETTER_MAX_WORDS ? "long" : "ok",
    cliches: findCliches(text),
  }
}
