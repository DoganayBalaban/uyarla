import { scoringConfigFor } from "@uyarla/core/score/config"
import { isGenericRequirement } from "@uyarla/core/score/score"
import type { Requirement } from "@uyarla/core/schemas/job"

/**
 * Skorun parçaları (analiz raporu şeridi): her gereksinim ve unvan, formüldeki
 * ağırlığı kadar yer kaplıyor, karşılanma oranı kadar doluyor. Toplam core'un
 * weightedScore'uyla aynı; ekran formülde olmayan bir şey çizmiyor.
 */
export interface ScorePart {
  /** Gereksinimin sonuçtaki sırası; unvan için null. */
  index: number | null
  label: string
  kind: "must" | "nice" | "generic" | "title"
  /** Formüldeki ağırlık. */
  weight: number
  /** 0–1: karşılanma oranı (kısmi eşleşme ara değer). */
  credit: number
  /** Tamamen karşılanırsa skora eklenecek puan, yuvarlanmış. */
  gain: number
}

interface PartInput {
  requirement: { text: string; importance: string; type: string; concepts?: Array<{ term: string }> }
  confidence: number
}

const TITLE_CREDIT: Record<string, number> = { exact: 1, partial: 0.5, none: 0 }

export function scoreParts(result: {
  requirements: PartInput[]
  excluded?: number[]
  titleMatch?: { level: string; position: string } | null
  scoringRevision?: number
}): { parts: ScorePart[]; score: number } {
  const cfg = scoringConfigFor(result.scoringRevision)
  const skip = new Set(result.excluded ?? [])
  const counted = result.requirements.map((r, index) => ({ r, index })).filter(({ index }) => !skip.has(index))
  // Havuz weightedScore'unkiyle aynı: kişisel nitelikler ve şartlar dışarıda,
  // ilanda yalnızca kişisel nitelik varsa onlar giriyor.
  const scored = counted.filter(({ r }) => !cfg.unscoredTypes.includes(r.requirement.type as Requirement["type"]))
  const pool = scored.length > 0 ? scored : counted.filter(({ r }) => r.requirement.type !== "condition")

  const raw: Omit<ScorePart, "gain">[] = pool.map(({ r, index }) => {
    const must = r.requirement.importance === "must"
    const importanceWeight = must ? cfg.mustWeight : cfg.niceWeight
    const generic =
      cfg.genericWeight !== null &&
      isGenericRequirement({
        type: r.requirement.type as Requirement["type"],
        concepts: (r.requirement.concepts ?? []) as Requirement["concepts"],
      })
    const weight = generic ? Math.min(importanceWeight, cfg.genericWeight!) : importanceWeight
    return {
      index,
      label: r.requirement.text,
      kind: generic && weight < importanceWeight ? "generic" : must ? "must" : "nice",
      weight,
      credit: Math.max(0, Math.min(1, r.confidence)),
    }
  })
  // Unvan bir zorunlu gereksinim gibi (sürüm 2+); eski analizlerde yok.
  if (result.titleMatch && cfg.titleWeight > 0) {
    raw.push({
      index: null,
      label: `İlandaki unvan: ${result.titleMatch.position}`,
      kind: "title",
      weight: cfg.titleWeight,
      credit: TITLE_CREDIT[result.titleMatch.level] ?? 0,
    })
  }

  const total = raw.reduce((s, p) => s + p.weight, 0)
  if (total === 0) return { parts: [], score: 0 }
  const sum = raw.reduce((s, p) => s + p.weight * p.credit, 0)
  return {
    parts: raw.map((p) => ({ ...p, gain: Math.round(((p.weight * (1 - p.credit)) / total) * 100) })),
    score: Math.round((sum / total) * 100),
  }
}
