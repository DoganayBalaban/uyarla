/**
 * Uyarlanmış CV'nin skoru (DOG-166). Uyarlama sayfası yeni skoru hesaplıyor
 * ama hiçbir yere yazmıyordu: pano, başvuru ayrıntısı ve mülakat paketi
 * analizdeki 58'i ve "2 zorunlu eksik"i göstermeye devam ediyordu; oysa
 * gönderilen CV 75'ti. Özet analiz sonucunda `adapted` anahtarında duruyor.
 *
 * Bağımlılıksız: web (istemci de) ve worker aynı okumayı kullanıyor.
 */

type TitleLevel = "exact" | "partial" | "none"

export interface AdaptedSummary {
  score: number
  /** Gereksinimlerin uyarlanmış CV'deki durumu, ilandaki sırayla. */
  statuses: string[]
  titleLevel: TitleLevel | null
}

/** Yeniden skorlamanın sonucundan saklanacak özet. */
export function adaptedSummary(outcome: {
  score: number
  requirements: Array<{ status: string }>
  titleMatch?: { level: TitleLevel; position?: string } | null
}): AdaptedSummary {
  return { score: outcome.score, statuses: outcome.requirements.map((r) => r.status), titleLevel: outcome.titleMatch?.level ?? null }
}

interface ResultShape {
  requirements?: Array<{ status: string }>
  titleMatch?: { level: TitleLevel; position: string } | null
  adapted?: AdaptedSummary
}

/**
 * Analiz sonucu, uyarlanmış CV'ye göre: gereksinim durumları ve unvan
 * özetten, `adaptedScore` uyarlanmış skor. Özet yoksa ya da gereksinim
 * sayısı tutmuyorsa (ilan sonradan değişti) sonuç olduğu gibi,
 * `adaptedScore` null.
 */
export function withAdaptation<T extends ResultShape | null>(result: T): T extends null ? null : T & { adaptedScore: number | null } {
  type Out = T extends null ? null : T & { adaptedScore: number | null }
  if (!result) return null as Out
  const summary = result.adapted
  const requirements = result.requirements ?? []
  if (!summary || summary.statuses.length !== requirements.length) return { ...result, adaptedScore: null } as Out
  return {
    ...result,
    requirements: requirements.map((r, i) => ({ ...r, status: summary.statuses[i]! })),
    titleMatch: result.titleMatch && summary.titleLevel ? { ...result.titleMatch, level: summary.titleLevel } : result.titleMatch,
    adaptedScore: summary.score,
  } as Out
}
