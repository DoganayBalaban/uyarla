import { scoreStatus } from "@/lib/scoreStatus"
import type { Stage } from "@/features/applications/board"

/**
 * Uyum skoru mülakatı öngörüyor mu (DOG-124). Skor bandına göre sonuçlanan
 * başvurular: ekrandaki etiketle aynı eşikler (scoreStatus). İç ölçüm
 * (scripts/calibration.ts) ve kullanıcının kendi panosundaki sinyal aynı
 * hesabı kullanıyor.
 *
 * Sonuçlanan: mülakat, teklif ya da ret. "Başvuruldu" henüz sonuç değil;
 * cevapsızlık sayılmıyor, çünkü ne kadar beklenince "ses yok" sayılacağı
 * bilinmiyor.
 */
export interface BandOutcome {
  label: string
  resolved: number
  /** Mülakat ya da teklif. */
  positive: number
  /** Başvuruldu, henüz sonuç yok. */
  waiting: number
}

/** Kullanıcıya sinyal göstermek için en az sonuçlanan başvuru. */
export const MIN_RESOLVED_FOR_SIGNAL = 3

const BANDS = ["Yüksek uyum", "Orta uyum", "Düşük uyum"] as const

export function outcomesByBand(rows: ReadonlyArray<{ score: number | null; stage: Stage; scoringRevision?: number }>): BandOutcome[] {
  const out = new Map<string, BandOutcome>(BANDS.map((label) => [label, { label, resolved: 0, positive: 0, waiting: 0 }]))
  for (const r of rows) {
    if (r.score === null || r.stage === "saved") continue
    const band = out.get(scoreStatus(r.score, r.scoringRevision).label)!
    if (r.stage === "applied") band.waiting++
    else {
      band.resolved++
      if (r.stage === "interview" || r.stage === "offer") band.positive++
    }
  }
  return [...out.values()]
}

/**
 * Kullanıcının kendi başvurularından sinyal: en az üç başvuru sonuçlanınca.
 * Yalnızca kendi verisi; başkalarının sonuçları kullanılmıyor.
 */
export function personalOutcomeSignal(rows: ReadonlyArray<{ score: number | null; stage: Stage; scoringRevision?: number }>): string[] | null {
  const bands = outcomesByBand(rows)
  if (bands.reduce((n, b) => n + b.resolved, 0) < MIN_RESOLVED_FOR_SIGNAL) return null
  return bands
    .filter((b) => b.resolved > 0)
    .map((b) => `${b.label.replace(" uyum", "")} uyumlu ${b.resolved} sonuçlanmış başvurunun ${b.positive} tanesi mülakata döndü.`)
}
