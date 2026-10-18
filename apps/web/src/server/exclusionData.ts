import { scoreWithExclusions } from "@/server/requirementExclusion"

/**
 * DOG-90 işaretlerinin veriye dönüşü: değerlendirme setine aktarım ve eski
 * analizlerin pano skorunun düzeltilmesi. Betikler (scripts/) bunları
 * veritabanından okuyup çağırıyor; mantık burada, test edilebilir.
 */

type StoredRequirement = {
  requirement: { text: string; type: string; importance: string; concepts?: Array<{ term: string; synonyms?: string[] }> }
  confidence: number
}

type StoredResult = {
  score?: number
  requirements: StoredRequirement[]
  excluded?: number[]
  exclusions?: Record<string, { reason: string; scope: string }>
  reports?: Array<{ index: number; reason: string }>
  titleMatch?: { level: string } | null
  scoringRevision?: number
}

export interface ExclusionRecord {
  analysisId: string
  createdAt: string
  position: string
  language: string
  postingText: string
  requirement: { text: string; type: string; importance: string; concepts: Array<{ term: string; synonyms?: string[] }> }
  reason: string
  /** `analysis` / `always`: işaret · `report`: hariç tutmayan "CV'mde var" bildirimi. */
  scope: string
}

/**
 * Bir analizin kullanıcı işaretleri ve bildirimleri. CV metni ve kanıtlar
 * yazılmıyor (KVKK): değerlendirme için ilan ve gereksinim yetiyor. Listeden
 * otomatik gelen işaretler (`profile`) atlanıyor; o ilan için yeni bir yargı
 * değiller.
 */
export function exclusionRecords(analysis: {
  id: string
  createdAt: Date
  result: unknown
  jobPosting: { position: string; language: string; rawText: string }
}): ExclusionRecord[] {
  const result = analysis.result as StoredResult | null
  if (!result?.requirements) return []
  const base = {
    analysisId: analysis.id,
    createdAt: analysis.createdAt.toISOString(),
    position: analysis.jobPosting.position,
    language: analysis.jobPosting.language,
    postingText: analysis.jobPosting.rawText,
  }
  const requirementAt = (i: number) => {
    const r = result.requirements[i]?.requirement
    return r ? { text: r.text, type: r.type, importance: r.importance, concepts: r.concepts ?? [] } : null
  }

  const out: ExclusionRecord[] = []
  for (const i of result.excluded ?? []) {
    // PR 117'nin işaretlerinde neden yok; o akış yalnız "ilanda yok" diyordu.
    const mark = result.exclusions?.[i] ?? { reason: "not_in_posting", scope: "analysis" }
    const requirement = requirementAt(i)
    if (mark.scope === "profile" || !requirement) continue
    out.push({ ...base, requirement, reason: mark.reason, scope: mark.scope })
  }
  for (const report of result.reports ?? []) {
    const requirement = requirementAt(report.index)
    if (requirement) out.push({ ...base, requirement, reason: report.reason, scope: "report" })
  }
  return out
}

/**
 * K-67'den önce işaret konmuş analizler: Analysis.score hâlâ ilk skor.
 * Düzeltilmesi gerekiyorsa yeni skor, gerekmiyorsa null.
 */
export function backfillScore(row: { score: number | null; result: unknown }): number | null {
  const result = row.result as (StoredResult & { score: number }) | null
  if (!result || row.score === null || !result.excluded?.length) return null
  const adjusted = scoreWithExclusions(result, result.excluded)
  return adjusted === row.score ? null : adjusted
}
