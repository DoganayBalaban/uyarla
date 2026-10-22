import { resumeLines, type ProfileLike } from "@/features/adaptation/waiting"
import { missingMustRequirements } from "@/features/analysis/readiness"

/**
 * Mülakat hazırlığı sürerken bekleme ekranının malzemesi (K-104): CV'den
 * kısa bir kesit ve ilanın karşılanmayan zorunlu şartları. Boşluk soruları
 * bu şartlardan çıkıyor; ekran yalnızca gerçek listeyi gösteriyor.
 */
export interface PrepWaitingPreview {
  lines: string[]
  gaps: string[]
}

const MAX_GAPS = 3

export function prepWaitingPreview(profile: ProfileLike | null, analysisResult: unknown): PrepWaitingPreview {
  return {
    lines: resumeLines(profile),
    gaps: missingMustRequirements(analysisResult)
      .slice(0, MAX_GAPS)
      .map((r) => r.text),
  }
}
