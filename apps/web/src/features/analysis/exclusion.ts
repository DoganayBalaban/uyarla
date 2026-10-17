import type { RequirementResult } from "@/features/analysis/components/ScoreResult"

/**
 * "İlanda yok, yanlış okunmuş" işaretlerinin ekrana yansıması (DOG-90).
 *
 * İşaretli gereksinim ne eksik ne karşılanmış sayılıyor: özet sayılardan ve
 * eksik kavramlardan çıkıyor, listede soluk duruyor ve geri alınabiliyor.
 *
 * Düzeltilmiş skor burada hesaplanıyor: core/score weightedScore ile aynı
 * formül ve ağırlıklar. İstemci core'u içe aktaramıyor (PDF/LLM kodu pakete
 * sızar); sunucu route'u da aktaramıyor (Vercel fonksiyon sınırı). İki kopya
 * exclusion.test.ts'teki eşlik testiyle bağlı: biri değişirse test kırılır.
 */
const MUST_WEIGHT = 2
const NICE_WEIGHT = 1

export function adjustedScore(
  requirements: Pick<RequirementResult, "requirement" | "confidence">[],
  excluded: readonly number[],
): number {
  const skip = new Set(excluded)
  let weightedSum = 0
  let totalWeight = 0
  requirements.forEach((r, i) => {
    if (skip.has(i)) return
    const weight = r.requirement.importance === "must" ? MUST_WEIGHT : NICE_WEIGHT
    totalWeight += weight
    weightedSum += weight * r.confidence
  })
  return totalWeight === 0 ? 0 : Math.round((weightedSum / totalWeight) * 100)
}
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
    // İşaret yoksa analizin kendi skoru; yeniden hesaplamak yuvarlama farkı
    // bile olsa ilk skoru oynatmasın.
    score: skip.size > 0 ? adjustedScore(result.requirements, [...skip]) : result.score,
    excludedCount: skip.size,
  }
}
