import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import type { RequirementResult } from "@/features/analysis/components/ScoreResult"
import { applyExclusions } from "@/features/analysis/exclusion"

/**
 * Uyarlama sürerken bekleme ekranının gösterdiği gerçek veri: CV'nin ilk
 * hâlinden kısa bir kesit ve analizde eksik kalan kavramlar. Ekran bunları
 * "üzerinde çalışılan" malzeme olarak çiziyor; uydurma ilerleme yok.
 */
export interface WaitingPreview {
  headline: string | null
  lines: string[]
  /** Analizde eksik kalan kavramlar; işaretli gereksinimlerinkiler düşmüş. */
  missing: string[]
  /** Uyarlamanın başladığı an; geçen süre sayacı yenilemede sıfırlanmasın. */
  startedAt: string
}

const MAX_LINES = 7
const MAX_LINE_LENGTH = 140
const MAX_MISSING = 8

type ProfileLike = Pick<ResumeProfile, "headline" | "summary"> & {
  experience: Array<{ bullets: Array<{ text: string }> }>
}

interface ResultLike {
  score: number
  requirements: Array<RequirementResult & { missingConcepts?: string[] }>
  missingKeywords: string[]
  excluded?: number[]
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > MAX_LINE_LENGTH ? `${clean.slice(0, MAX_LINE_LENGTH - 1).trimEnd()}…` : clean
}

function isResult(value: unknown): value is ResultLike {
  const v = value as Partial<ResultLike> | null
  return !!v && Array.isArray(v.requirements) && Array.isArray(v.missingKeywords)
}

export function waitingPreview(profile: ProfileLike | null, analysisResult: unknown, startedAt: Date): WaitingPreview {
  const lines: string[] = []
  if (profile?.summary?.trim()) lines.push(shorten(profile.summary))
  for (const job of profile?.experience ?? []) {
    for (const bullet of job.bullets) {
      if (lines.length >= MAX_LINES) break
      if (bullet.text.trim()) lines.push(shorten(bullet.text))
    }
  }

  let missing: string[] = []
  if (isResult(analysisResult)) {
    try {
      missing = applyExclusions(analysisResult).missingKeywords.slice(0, MAX_MISSING)
    } catch {
      // Bekleme ekranının süsü; bozuk eski kayıt uyarlamayı engellemesin.
      missing = []
    }
  }

  return { headline: profile?.headline?.trim() || null, lines, missing, startedAt: startedAt.toISOString() }
}
