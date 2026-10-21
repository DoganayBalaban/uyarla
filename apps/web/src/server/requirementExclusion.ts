import type { ExclusionMark, ExclusionReason, RequirementCorrection, RequirementReport } from "@uyarla/core/score/exclusions"
import { adjustedScore } from "@/features/analysis/exclusion"

/**
 * Gereksinimi işaretleme, nedeni ve şart düzeltmesi (DOG-90).
 *
 * İşaretler sonucun içinde duruyor; ilk skor da orada (result.score).
 * Analysis.score düzeltilmiş skor: pano ve başvuru kartları onu gösteriyor.
 * Uyarlamanın "sonra" skoru ve taslağı da aynı işaretlerle hesaplanıyor
 * (K-67). Aynı işaretler kavram ayırma hatalarının gerçek verisi.
 */

const REASONS: readonly ExclusionReason[] = ["not_in_posting", "irrelevant", "found_in_cv"]
const MAX_YEARS = 40
const MAX_TERMS = 8
const MAX_TERM_LENGTH = 80
const MAX_POSITION_LENGTH = 120

export type AnalysisPatch =
  | { action: "exclude"; requirementIndex: number; reason: ExclusionReason; always: boolean }
  | { action: "include"; requirementIndex: number }
  | { action: "correct"; requirementIndex: number; minYears?: number | null; terms?: string[] | null }
  /** İlan unvanının düzeltmesi (DOG-134); null düzeltmeyi kaldırıyor. */
  | { action: "position"; position: string | null }

/** PATCH /api/analysis/[id] gövdesi; geçersizse null. Eski `{ requirementIndex, excluded }` gövdesi de geçerli. */
export function parseAnalysisPatch(body: unknown): AnalysisPatch | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>

  // Unvan bir gereksinim değil; sıra numarası almıyor.
  if (b.action === "position") {
    if (b.position === null) return { action: "position", position: null }
    if (typeof b.position !== "string") return null
    const position = b.position.trim()
    if (!position || position.length > MAX_POSITION_LENGTH) return null
    return { action: "position", position }
  }

  const index = b.requirementIndex
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null

  // PR 117'nin gövdesi: açık sekmeler ve eski istemciler bunu gönderiyor.
  if (b.action === undefined && typeof b.excluded === "boolean") {
    return b.excluded
      ? { action: "exclude", requirementIndex: index, reason: "not_in_posting", always: false }
      : { action: "include", requirementIndex: index }
  }

  if (b.action === "include") return { action: "include", requirementIndex: index }

  if (b.action === "exclude") {
    if (!REASONS.includes(b.reason as ExclusionReason)) return null
    const reason = b.reason as ExclusionReason
    // "CV'mde var" hariç tutmuyor, kalıcı listeye de giremez.
    return { action: "exclude", requirementIndex: index, reason, always: reason !== "found_in_cv" && b.always === true }
  }

  if (b.action === "correct") {
    const out: Extract<AnalysisPatch, { action: "correct" }> = { action: "correct", requirementIndex: index }
    if ("minYears" in b) {
      if (b.minYears === null) out.minYears = null
      else if (typeof b.minYears === "number" && Number.isInteger(b.minYears) && b.minYears >= 1 && b.minYears <= MAX_YEARS) {
        out.minYears = b.minYears
      } else return null
    }
    if ("terms" in b) {
      if (b.terms === null) out.terms = null
      else if (Array.isArray(b.terms) && b.terms.every((t) => typeof t === "string")) {
        const terms = (b.terms as string[]).map((t) => t.trim()).filter(Boolean)
        if (terms.length === 0 || terms.length > MAX_TERMS || terms.some((t) => t.length > MAX_TERM_LENGTH)) return null
        out.terms = terms
      } else return null
    }
    return "minYears" in out || "terms" in out ? out : null
  }

  return null
}

type Marks = {
  excluded?: number[]
  exclusions?: Record<number, ExclusionMark>
  reports?: RequirementReport[]
}

type WithRequirements = { requirements: Array<{ requirement?: { concepts?: Array<{ term: string }> } } | object> }

/**
 * Gereksinimi işaretler. `remember`: "tüm ilanlarda" seçildiyse listeye
 * yazılacak kavram terimleri. "CV'mde var" hariç tutmuyor, bildirim olarak
 * kaydediliyor.
 */
export function markRequirement<T extends WithRequirements & Marks>(
  result: T,
  index: number,
  mark: { reason: ExclusionReason; always: boolean },
  at: string,
): { result: T & Marks; remember: string[] } {
  ensureIndex(result, index)
  if (mark.reason === "found_in_cv") {
    const reports = result.reports ?? []
    if (reports.some((r) => r.index === index)) return { result, remember: [] }
    return { result: { ...result, reports: [...reports, { index, reason: "found_in_cv", at }] }, remember: [] }
  }
  const excluded = setRequirementExcluded(result, index, true)
  const exclusions = { ...(result.exclusions ?? {}), [index]: { reason: mark.reason, scope: mark.always ? "always" : "analysis" } }
  const requirement = (result.requirements[index] as { requirement?: { concepts?: Array<{ term: string }> } }).requirement
  const remember = mark.always ? (requirement?.concepts ?? []).map((c) => c.term) : []
  return { result: { ...result, excluded, exclusions }, remember }
}

/** İşareti kaldırır. Kalıcı listeye dokunmuyor; o hesap ayarlarından yönetiliyor. */
export function unmarkRequirement<T extends WithRequirements & Marks>(result: T, index: number): T & Marks {
  ensureIndex(result, index)
  const exclusions = { ...(result.exclusions ?? {}) }
  delete exclusions[index]
  return { ...result, excluded: setRequirementExcluded(result, index, false), exclusions }
}

function ensureIndex(result: { requirements: unknown[] }, index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= result.requirements.length) {
    throw new RangeError(`Gereksinim bulunamadı: ${index}`)
  }
}

export function setRequirementExcluded(
  result: { requirements: unknown[]; excluded?: number[] },
  index: number,
  excluded: boolean,
): number[] {
  ensureIndex(result, index)
  const current = new Set(result.excluded ?? [])
  if (excluded) current.add(index)
  else current.delete(index)
  return [...current].sort((a, b) => a - b)
}

/**
 * Analysis.score'a yazılacak skor: işaret ve düzeltme yoksa ilk skor, varsa
 * sonucun formül sürümüyle yeniden hesaplanmış skor (core weightedScore).
 */
export function scoreWithExclusions(
  result: {
    score: number
    requirements: Array<{ requirement: { text: string; importance: string; type: string }; confidence: number }>
    titleMatch?: { level: string } | null
    scoringRevision?: number
    corrections?: Record<number, unknown>
    positionCorrection?: string
  },
  excluded: readonly number[],
): number {
  const corrected = Object.keys(result.corrections ?? {}).length > 0 || !!result.positionCorrection
  if (excluded.length === 0 && !corrected) return result.score
  return adjustedScore(result.requirements, excluded, { title: result.titleMatch, revision: result.scoringRevision })
}

/**
 * Bir gereksinimin düzeltmesini mevcut düzeltmelerle birleştirir. `null`
 * alanı kaldırıyor; alanı kalmayan düzeltme silinir.
 */
export function mergeCorrection(
  current: Record<number, RequirementCorrection> | undefined,
  index: number,
  fix: { minYears?: number | null; terms?: string[] | null },
): Record<number, RequirementCorrection> {
  const next: RequirementCorrection = { ...(current?.[index] ?? {}) }
  if (fix.minYears === null) delete next.minYears
  else if (fix.minYears !== undefined) next.minYears = fix.minYears
  if (fix.terms === null) delete next.terms
  else if (fix.terms !== undefined) next.terms = fix.terms
  const all = { ...(current ?? {}) }
  if (Object.keys(next).length === 0) delete all[index]
  else all[index] = next
  return all
}
