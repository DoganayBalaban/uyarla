/** Sonuç başlığındaki somut ifadeler için gereksinim sayımı (DOG-66). */
interface RequirementLike {
  requirement: { importance: string }
  status: "matched" | "missing"
  method: string | null
  confidence: number
}

/**
 * Kısmen karşılanan gereksinim: kelime eşleşmesi tuttu ama bileşik
 * gereksinimin kavramlarının yalnızca bir kısmı CV'de var ("Git ve CI/CD"
 * isteyen ilanda yalnızca Git). Kelime eşleşmesinde `confidence` karşılanan
 * kavram oranı (K-23). Anlamsal eşleşmede ise benzerlik değeri; orada 1'in
 * altı "kısmen" demek değil.
 */
export function isPartial(item: RequirementLike): boolean {
  return item.status === "matched" && item.method === "keyword" && item.confidence < 1
}

export interface RequirementSummary {
  total: number
  matched: number
  mustTotal: number
  mustMatched: number
  partial: number
}

export function summarizeRequirements(items: RequirementLike[]): RequirementSummary {
  const must = items.filter((i) => i.requirement.importance === "must")
  return {
    total: items.length,
    matched: items.filter((i) => i.status === "matched").length,
    mustTotal: must.length,
    mustMatched: must.filter((i) => i.status === "matched").length,
    partial: items.filter(isPartial).length,
  }
}
