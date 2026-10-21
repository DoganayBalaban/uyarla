import { DEFAULT_SCORING_CONFIG, SCORING_REVISION, type ScoringConfig } from "@uyarla/core/score/config"

/**
 * Sonuç bölümlerinin skor etkisi rozetleri (DOG-132). Etiketler elle
 * yazılmıyor, skor formülünün ağırlıklarından türüyor: formül değişince
 * rozet de değişir, ekranda formülle çelişen bir iddia kalmaz.
 */
export interface ScoreImpact {
  /** "scored": skora katılıyor; "unscored": katılmıyor. */
  tone: "scored" | "unscored"
  label: string
  /** Etiketin dayanağı, tek cümle. */
  hint: string
}

export interface ScoreImpacts {
  requirements: ScoreImpact
  /** Eski formülde (sürüm 1) unvan skorda değildi. */
  title: ScoreImpact | null
  soft: ScoreImpact | null
  conditions: ScoreImpact | null
  format: ScoreImpact
}

const UNSCORED = "Skora katılmıyor"

/** 2 → "2", 1.5 → "1,5". */
function times(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })
}

export function scoreImpacts(revision: number | undefined, config: ScoringConfig = DEFAULT_SCORING_CONFIG): ScoreImpacts {
  const current = (revision ?? 1) >= SCORING_REVISION
  const unscored: readonly string[] = current ? config.unscoredTypes : []
  const ratio = config.mustWeight / config.niceWeight
  const titleScored = current && config.titleWeight > 0

  const titleHint =
    config.titleWeight === config.mustWeight
      ? "İlandaki unvan skorda bir zorunlu gereksinim kadar sayılır."
      : `İlandaki unvan skorda tercih edilen bir gereksinimin ${times(config.titleWeight / config.niceWeight)} katı sayılır.`

  return {
    requirements: {
      tone: "scored",
      label: "Skoru belirler",
      hint:
        ratio === 1
          ? "Zorunlu ve tercih edilen gereksinimler skorda eşit sayılır."
          : `Zorunlu bir gereksinim skorda tercih edilenin ${times(ratio)} katı sayılır.`,
    },
    title: titleScored ? { tone: "scored", label: "Skoru etkiler", hint: titleHint } : null,
    soft: unscored.includes("soft")
      ? { tone: "unscored", label: UNSCORED, hint: "Kişisel nitelikler CV'den anlaşılmadığı için skora katılmıyor." }
      : null,
    conditions: unscored.includes("condition")
      ? { tone: "unscored", label: UNSCORED, hint: "Şartlar evet/hayır sorusu; skora katılmıyor, kendin kontrol et." }
      : null,
    format: {
      tone: "unscored",
      label: UNSCORED,
      hint: titleScored
        ? "Okunabilirlik ve içerik bulguları skoru değiştirmez; yalnızca unvan bulgusu skora katılır."
        : "Okunabilirlik ve içerik bulguları skoru değiştirmez.",
    },
  }
}

/** Unvan bulgusunun kodları (titleFinding.ts). */
export const TITLE_FINDING_CODES: readonly string[] = ["title_missing", "title_partial"]
