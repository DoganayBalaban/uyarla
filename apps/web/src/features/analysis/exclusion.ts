import type { RequirementResult } from "@/features/analysis/components/ScoreResult"

/**
 * "İlanda yok, yanlış okunmuş" işaretlerinin ekrana yansıması (DOG-90).
 *
 * İşaretli gereksinim ne eksik ne karşılanmış sayılıyor: özet sayılardan ve
 * eksik kavramlardan çıkıyor, listede soluk duruyor ve geri alınabiliyor.
 * Skor sunucudan geliyor (adjustedScore); burada yalnızca sayım var.
 */
export interface ExclusionView<T extends RequirementResult> {
  rows: Array<{ item: T; index: number; excluded: boolean }>
  /** Sayımlarda kullanılacak, işaretli olmayan gereksinimler. */
  active: T[]
  missingKeywords: string[]
  score: number
  excludedCount: number
}

export function applyExclusions<T extends RequirementResult & { missingConcepts?: string[] }>(result: {
  score: number
  requirements: T[]
  missingKeywords: string[]
  excluded?: number[]
  adjustedScore?: number
}): ExclusionView<T> {
  const skip = new Set(result.excluded ?? [])
  const rows = result.requirements.map((item, index) => ({ item, index, excluded: skip.has(index) }))
  const active = rows.filter((r) => !r.excluded).map((r) => r.item)

  // Bir kavram yalnızca işaretli gereksinimlerde eksikse listeden düşüyor;
  // başka bir gereksinimde de eksikse kalıyor.
  const stillMissing = new Set(active.flatMap((r) => r.missingConcepts ?? []))
  const onlyExcluded = new Set(
    rows.filter((r) => r.excluded).flatMap((r) => (r.item.missingConcepts ?? []).filter((k) => !stillMissing.has(k))),
  )

  return {
    rows,
    active,
    missingKeywords: result.missingKeywords.filter((k) => !onlyExcluded.has(k)),
    score: skip.size > 0 && result.adjustedScore !== undefined ? result.adjustedScore : result.score,
    excludedCount: skip.size,
  }
}
