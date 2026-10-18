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
/** Skora katılmayan türler ve unvan ağırlığı: core/score/config.ts (DOG-103). */
const UNSCORED_TYPES = ["soft"]
const TITLE_WEIGHT = 2
const TITLE_CREDIT: Record<string, number> = { exact: 1, partial: 0.5, none: 0 }
/** core SCORING_REVISION; bundan eski analizler eski formülle (soft dahil, unvansız). */
const SCORING_REVISION = 2

export function adjustedScore(
  requirements: Pick<RequirementResult, "requirement" | "confidence">[],
  excluded: readonly number[],
  context: { title?: { level: string } | null; revision?: number } = { revision: SCORING_REVISION },
): number {
  const skip = new Set(excluded)
  const current = (context.revision ?? 1) >= SCORING_REVISION
  const counted = requirements.filter((_, i) => !skip.has(i))
  const scored = current ? counted.filter((r) => !UNSCORED_TYPES.includes(r.requirement.type)) : counted
  const pool = scored.length > 0 ? scored : counted
  if (pool.length === 0) return 0

  let weightedSum = 0
  let totalWeight = 0
  for (const r of pool) {
    const weight = r.requirement.importance === "must" ? MUST_WEIGHT : NICE_WEIGHT
    totalWeight += weight
    weightedSum += weight * r.confidence
  }
  if (current && context.title) {
    totalWeight += TITLE_WEIGHT
    weightedSum += TITLE_WEIGHT * (TITLE_CREDIT[context.title.level] ?? 0)
  }
  return Math.round((weightedSum / totalWeight) * 100)
}
export interface ExclusionView<T extends RequirementResult> {
  /** Skora katılan gereksinimler, işaretliler dahil (soluk gösteriliyor). */
  rows: Array<{ item: T; index: number; excluded: boolean }>
  /**
   * Skora katılmayan kişisel nitelikler (DOG-103): ayrı blokta, "eksik"
   * sayılmadan gösteriliyor. Eski analizlerde boş; onların skoru soft dahil.
   */
  softRows: Array<{ item: T; index: number }>
  /** Sayımlarda kullanılacak: skora katılan ve işaretli olmayan gereksinimler. */
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
  titleMatch?: { level: string } | null
  scoringRevision?: number
}): ExclusionView<T> {
  const skip = new Set(result.excluded ?? [])
  const current = (result.scoringRevision ?? 1) >= SCORING_REVISION
  const all = result.requirements.map((item, index) => ({ item, index, excluded: skip.has(index) }))
  // İlanda yalnızca kişisel nitelik varsa skora onlar giriyor (core ile aynı).
  const separateSoft = current && all.some((r) => !UNSCORED_TYPES.includes(r.item.requirement.type))
  const isSoft = (r: { item: T }) => separateSoft && UNSCORED_TYPES.includes(r.item.requirement.type)
  const rows = all.filter((r) => !isSoft(r))
  const softRows = all.filter(isSoft).map(({ item, index }) => ({ item, index }))
  const active = rows.filter((r) => !r.excluded).map((r) => r.item)

  // Bir kavram yalnızca işaretli ya da kişisel nitelik gereksinimlerinde
  // eksikse listeden düşüyor; skora katılan başka bir gereksinimde de
  // eksikse kalıyor.
  const stillMissing = new Set(active.flatMap((r) => r.missingConcepts ?? []))
  const dropped = new Set(
    all
      .filter((r) => r.excluded || isSoft(r))
      .flatMap((r) => (r.item.missingConcepts ?? []).filter((k) => !stillMissing.has(k))),
  )

  return {
    rows,
    softRows,
    active,
    missingKeywords: result.missingKeywords.filter((k) => !dropped.has(k)),
    // İşaret yoksa analizin kendi skoru; yeniden hesaplamak yuvarlama farkı
    // bile olsa ilk skoru oynatmasın.
    score:
      skip.size > 0
        ? adjustedScore(result.requirements, [...skip], { title: result.titleMatch, revision: result.scoringRevision })
        : result.score,
    excludedCount: skip.size,
  }
}
