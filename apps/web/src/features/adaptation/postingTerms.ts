import { keywordSpans } from "@uyarla/core/normalize/highlight"

/**
 * İlan terimleri (DOG-92): vurgu ve kapsama için. Eşleşme skorlamayla aynı
 * kural (core normalize/highlight); vurgulanan terim skorda da sayılıyor.
 */
export interface PostingTerm {
  term: string
  /** Terim ve eş anlamlıları; herhangi biri geçerse terim geçmiş sayılır. */
  variants: string[]
  must: boolean
}

interface RequirementLike {
  type: string
  importance: string
  concepts: Array<{ term: string; synonyms: string[] }>
}

/**
 * İlan gereksinimlerinden terim listesi. Şartlar ve skordan çıkan kişisel
 * nitelikler (DOG-103, DOG-115) ile kullanıcının "ilanda yok" dedikleri
 * (DOG-90) yok; aynı terim iki gereksinimde geçiyorsa bir kez, zorunluysa
 * zorunlu.
 */
export function postingTermsFrom(
  requirements: readonly RequirementLike[],
  options: { excluded?: readonly number[]; scoringRevision?: number } = {},
): PostingTerm[] {
  const excluded = new Set(options.excluded ?? [])
  const skipSoft = (options.scoringRevision ?? 1) >= 2
  const byTerm = new Map<string, PostingTerm>()
  requirements.forEach((r, i) => {
    if (excluded.has(i) || r.type === "condition" || (skipSoft && r.type === "soft")) return
    for (const c of r.concepts) {
      const key = c.term.toLocaleLowerCase("tr")
      const prev = byTerm.get(key)
      const must = r.importance === "must"
      if (prev) prev.must ||= must
      else byTerm.set(key, { term: c.term, variants: [c.term, ...c.synonyms], must })
    }
  })
  return [...byTerm.values()]
}

const allVariants = (terms: readonly PostingTerm[]) => terms.flatMap((t) => t.variants)

/** Metinde geçen terimler (yazarken canlı gösterim için). */
export function termsIn(text: string, terms: readonly PostingTerm[]): PostingTerm[] {
  const hit = new Set(keywordSpans(text, allVariants(terms)).map((s) => s.keyword))
  return terms.filter((t) => t.variants.some((v) => hit.has(v)))
}

/** Belgenin tamamında geçen ve geçmeyen terimler. */
export function termCoverage(texts: readonly string[], terms: readonly PostingTerm[]): { found: PostingTerm[]; missing: PostingTerm[] } {
  const found = termsIn(texts.join("\n"), terms)
  const set = new Set(found)
  return { found, missing: terms.filter((t) => !set.has(t)) }
}

/** Vurgulanacak parçalar: düz metin ve terim. */
export function highlightParts(text: string, terms: readonly PostingTerm[]): Array<{ text: string; term: boolean }> {
  const parts: Array<{ text: string; term: boolean }> = []
  let at = 0
  for (const s of keywordSpans(text, allVariants(terms))) {
    if (s.start > at) parts.push({ text: text.slice(at, s.start), term: false })
    parts.push({ text: text.slice(s.start, s.end), term: true })
    at = s.end
  }
  if (at < text.length) parts.push({ text: text.slice(at), term: false })
  return parts
}
