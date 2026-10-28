/**
 * Başvuru panosunun aşamaları, etiketleri ve renkleri. Bağımlılığı yok:
 * tanıtım sayfası da kullanıyor (DOG-161); board.ts buradan yeniden dışa aktarıyor.
 */

export const STAGES = ["saved", "applied", "interview", "offer", "rejected"] as const
export type Stage = (typeof STAGES)[number]

/** Marka rehberi §8: "başvuru panosu" terimi; sütun adları kısa fiil/isim. */
export const STAGE_LABEL: Record<Stage, string> = {
  saved: "Kaydedildi",
  applied: "Başvuruldu",
  interview: "Mülakat",
  offer: "Teklif",
  rejected: "Olmadı",
}

/**
 * Aşamanın rengi; pano sütunlarında ve dashboard'da aynı. Aşama bir durum
 * bildirdiği için durum renkleri burada yerinde (rehber §9.2).
 */
export const STAGE_COLOR: Record<Stage, string> = {
  saved: "bg-muted-foreground",
  applied: "bg-brand-blue",
  interview: "bg-brand-amber",
  offer: "bg-brand-green",
  rejected: "bg-brand-red",
}

export function isStage(val: unknown): val is Stage {
  return typeof val === "string" && (STAGES as readonly string[]).includes(val)
}
