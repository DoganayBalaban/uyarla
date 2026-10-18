import { adjustedScore } from "@/features/analysis/exclusion"

/**
 * Gereksinimi "ilanda yok, yanlış okunmuş" diye işaretleme (DOG-90).
 *
 * İşaretler sonucun içinde duruyor; ilk skor da orada (result.score).
 * Analysis.score düzeltilmiş skor: pano ve başvuru kartları onu gösteriyor.
 * Uyarlamanın "sonra" skoru ve taslağı da aynı işaretlerle hesaplanıyor
 * (ikinci adım); önce/sonra aynı gereksinim kümesine bakıyor. Aynı işaretler
 * kavram ayırma hatalarının gerçek verisi.
 */
export function setRequirementExcluded(
  result: { requirements: unknown[]; excluded?: number[] },
  index: number,
  excluded: boolean,
): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= result.requirements.length) {
    throw new RangeError(`Gereksinim bulunamadı: ${index}`)
  }
  const current = new Set(result.excluded ?? [])
  if (excluded) current.add(index)
  else current.delete(index)
  return [...current].sort((a, b) => a - b)
}

/**
 * İşaretlerden sonra Analysis.score'a yazılacak skor: işaret yoksa ilk skor,
 * varsa sonucun formül sürümüyle düzeltilmiş skor (core weightedScore'un eşi).
 */
export function scoreWithExclusions(
  result: {
    score: number
    requirements: Array<{ requirement: { text: string; importance: string; type: string }; confidence: number }>
    titleMatch?: { level: string } | null
    scoringRevision?: number
  },
  excluded: readonly number[],
): number {
  if (excluded.length === 0) return result.score
  return adjustedScore(result.requirements, excluded, { title: result.titleMatch, revision: result.scoringRevision })
}
