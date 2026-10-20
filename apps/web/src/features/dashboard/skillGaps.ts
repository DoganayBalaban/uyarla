import { conceptKey } from "@uyarla/core/score/exclusions"

/**
 * Beceri açığı raporu (DOG-119): son analizlerde en sık eksik kalan
 * kavramlar. ai-job-search `/upskill`'in ucuz hâli: veri zaten her analizde
 * (gereksinimlerin eksik kavramları ve önemi). LLM yok; öğrenme kaynağı
 * önermiyoruz (model var olmayan bağlantı uydurabilir).
 *
 * Sayılmayanlar:
 *   - "İlanda yok" diye işaretlenen gereksinimler ve kullanıcının "tüm
 *     ilanlarda hariç tut" listesi (DOG-90).
 *   - Kişisel nitelikler ve evet/hayır şartları: CV'den anlaşılmıyorlar,
 *     öğrenilecek bir beceri değiller (DOG-103, DOG-115).
 *
 * Ağırlık: kavramın eksik kaldığı her ilan 1, orada zorunluysa 2. Aynı ilanda
 * iki gereksinimde geçse de bir kez sayılıyor.
 */
export const GAP_WINDOW = 20
export const GAP_LIMIT = 5
/** Daha az analizle "sık" demek anlamsız. */
export const GAP_MIN_ANALYSES = 3
/** Tek ilanda eksik kalan kavram açık değil, o ilanın özelliği. */
export const GAP_MIN_POSTINGS = 2

export interface SkillGap {
  term: string
  /** Eksik kaldığı ilan sayısı. */
  postings: number
  /** Bunların kaçında zorunlu. */
  must: number
}

interface StoredRequirement {
  requirement?: { importance?: string; type?: string }
  missingConcepts?: string[]
}

const UNCOUNTED_TYPES = new Set(["soft", "condition"])

export function skillGaps(
  results: unknown[],
  excludedKeys: Iterable<string> = [],
): { gaps: SkillGap[]; analyses: number } {
  const skip = new Set(excludedKeys)
  const totals = new Map<string, { term: string; postings: number; must: number; weight: number }>()

  for (const raw of results) {
    const result = raw as { requirements?: StoredRequirement[]; excluded?: number[] } | null
    if (!result?.requirements) continue
    const excluded = new Set(result.excluded ?? [])
    // Bu ilanda eksik kalan kavramlar: zorunlu mu?
    const inPosting = new Map<string, { term: string; must: boolean }>()
    result.requirements.forEach((r, i) => {
      if (excluded.has(i) || UNCOUNTED_TYPES.has(r.requirement?.type ?? "")) return
      for (const term of r.missingConcepts ?? []) {
        const key = conceptKey(term)
        if (!key || skip.has(key)) continue
        const seen = inPosting.get(key)
        const must = r.requirement?.importance === "must"
        inPosting.set(key, { term: seen?.term ?? term.trim(), must: (seen?.must ?? false) || must })
      }
    })
    for (const [key, { term, must }] of inPosting) {
      const t = totals.get(key) ?? { term, postings: 0, must: 0, weight: 0 }
      t.postings++
      if (must) t.must++
      t.weight += must ? 2 : 1
      totals.set(key, t)
    }
  }

  const analyses = results.filter((r) => (r as { requirements?: unknown } | null)?.requirements).length
  if (analyses < GAP_MIN_ANALYSES) return { gaps: [], analyses }
  const gaps = [...totals.values()]
    .filter((t) => t.postings >= GAP_MIN_POSTINGS)
    .sort((a, b) => b.weight - a.weight || b.postings - a.postings || a.term.localeCompare(b.term, "tr"))
    .slice(0, GAP_LIMIT)
    .map(({ term, postings, must }) => ({ term, postings, must }))
  return { gaps, analyses }
}
