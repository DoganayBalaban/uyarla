import type { RequirementResult } from "@/features/analysis/components/ScoreResult"
import { DEFAULT_SCORING_CONFIG, SCORING_REVISION } from "@uyarla/core/score/config"
import { weightedScore } from "@uyarla/core/score/score"
import type { RequirementResult as CoreRequirementResult } from "@uyarla/core/score/score"
import type { TitleMatch } from "@uyarla/core/score/title"

/**
 * "İlanda yok, yanlış okunmuş" işaretlerinin ekrana yansıması (DOG-90).
 *
 * İşaretli gereksinim ne eksik ne karşılanmış sayılıyor: özet sayılardan ve
 * eksik kavramlardan çıkıyor, listede soluk duruyor ve geri alınabiliyor.
 *
 * Düzeltilmiş skor core'un weightedScore'u. Eskiden burada formülün bir
 * kopyası vardı: route core'u içe aktarınca Vercel fonksiyon sınırı aşılıyor,
 * istemci de skor modülü üzerinden OpenAI istemcisini çekiyordu. Alt yollar
 * (K-68) ve bağımlılıksız vektör modülüyle ikisi de kalktı.
 */
const UNSCORED_TYPES: readonly string[] = DEFAULT_SCORING_CONFIG.unscoredTypes

/** Eski formül (sürüm 1): kişisel nitelikler skorda, unvan yok. */
const LEGACY_CONFIG = { ...DEFAULT_SCORING_CONFIG, unscoredTypes: [] }

export function adjustedScore(
  requirements: Pick<RequirementResult, "requirement" | "confidence">[],
  excluded: readonly number[],
  context: { title?: { level: string } | null; revision?: number } = { revision: SCORING_REVISION },
): number {
  const current = (context.revision ?? 1) >= SCORING_REVISION
  // Kayıtlı sonuç JSON'dan geliyor; alanlar core tipinin dar birleşimlerini
  // taşıyor ama derleyici bunu bilmiyor.
  return weightedScore(
    requirements as unknown as Pick<CoreRequirementResult, "requirement" | "confidence">[],
    current ? DEFAULT_SCORING_CONFIG : LEGACY_CONFIG,
    excluded,
    current ? ((context.title as Pick<TitleMatch, "level"> | null | undefined) ?? null) : null,
  )
}

export interface ExclusionView<T extends RequirementResult> {
  /** Skora katılan gereksinimler, işaretliler dahil (soluk gösteriliyor). */
  rows: Array<{ item: T; index: number; excluded: boolean }>
  /**
   * Skora katılmayan kişisel nitelikler (DOG-103): ayrı blokta, "eksik"
   * sayılmadan gösteriliyor. Eski analizlerde boş; onların skoru soft dahil.
   */
  softRows: Array<{ item: T; index: number }>
  /**
   * Evet/hayır şartları (DOG-115): ikamet, ehliyet, askerlik, seyahat. Skora
   * hiçbir durumda katılmıyor ve eksik sayılmıyor; "Şartlar" kutusunda.
   */
  conditionRows: Array<{ item: T; index: number }>
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
  /** Şart düzeltmeleri (DOG-90): varsa gereksinimler yeniden hesaplanmış, skor da. */
  corrections?: Record<number, unknown>
}): ExclusionView<T> {
  const skip = new Set(result.excluded ?? [])
  const current = (result.scoringRevision ?? 1) >= SCORING_REVISION
  const all = result.requirements.map((item, index) => ({ item, index, excluded: skip.has(index) }))
  // İlanda yalnızca kişisel nitelik varsa skora onlar giriyor (core ile aynı).
  const separateSoft = current && all.some((r) => !UNSCORED_TYPES.includes(r.item.requirement.type))
  const isCondition = (r: { item: T }) => r.item.requirement.type === "condition"
  const isSoft = (r: { item: T }) => separateSoft && !isCondition(r) && UNSCORED_TYPES.includes(r.item.requirement.type)
  const rows = all.filter((r) => !isSoft(r) && !isCondition(r))
  const softRows = all.filter(isSoft).map(({ item, index }) => ({ item, index }))
  const conditionRows = all.filter(isCondition).map(({ item, index }) => ({ item, index }))
  const active = rows.filter((r) => !r.excluded).map((r) => r.item)

  // Bir kavram yalnızca işaretli ya da kişisel nitelik gereksinimlerinde
  // eksikse listeden düşüyor; skora katılan başka bir gereksinimde de
  // eksikse kalıyor.
  const stillMissing = new Set(active.flatMap((r) => r.missingConcepts ?? []))
  const dropped = new Set(
    all
      .filter((r) => r.excluded || isSoft(r) || isCondition(r))
      .flatMap((r) => (r.item.missingConcepts ?? []).filter((k) => !stillMissing.has(k))),
  )

  return {
    rows,
    softRows,
    conditionRows,
    active,
    missingKeywords: result.missingKeywords.filter((k) => !dropped.has(k)),
    // İşaret yoksa analizin kendi skoru; yeniden hesaplamak yuvarlama farkı
    // bile olsa ilk skoru oynatmasın.
    score:
      skip.size > 0 || Object.keys(result.corrections ?? {}).length > 0
        ? adjustedScore(result.requirements, [...skip], { title: result.titleMatch, revision: result.scoringRevision })
        : result.score,
    excludedCount: skip.size,
  }
}
