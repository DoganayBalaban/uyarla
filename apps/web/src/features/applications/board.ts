/**
 * Başvuru panosunun saf mantığı: aşamalar, etiketler ve kartların
 * sıralanması. Veritabanına dokunmuyor; test edilebilir kalsın diye API
 * uçlarından ayrı.
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
  saved: "bg-gri",
  applied: "bg-mavi",
  interview: "bg-kehribar",
  offer: "bg-yesil",
  rejected: "bg-kirmizi",
}

export function isStage(val: unknown): val is Stage {
  return typeof val === "string" && (STAGES as readonly string[]).includes(val)
}

export const NOTE_MAX_LENGTH = 500

export interface BoardCard {
  analysisId: string
  position: string
  score: number | null
  stage: Stage
  stageChangedAt: string | null
  noteText: string | null
  createdAt: string
  adaptation: { id: string; status: string } | null
}

/** Panonun veritabanından okuduğu alanlar; iki uç da aynı seçimi kullanıyor. */
export const BOARD_SELECT = {
  id: true,
  score: true,
  stage: true,
  stageChangedAt: true,
  note: true,
  createdAt: true,
  jobPosting: { select: { position: true, rawText: true } },
  adaptation: { select: { id: true, status: true } },
} as const

/** Veritabanından gelen satır; yalnızca panonun okuduğu alanlar. */
export interface BoardRow {
  id: string
  score: number | null
  stage: string
  stageChangedAt: Date | null
  note: string | null
  createdAt: Date
  jobPosting: { position: string; rawText: string }
  adaptation: { id: string; status: string } | null
}

/**
 * Pozisyon adı ilan çıkarımından geliyor; boşsa (eski kayıtlar, Sprint 1)
 * ilan metninin ilk dolu satırı kullanılıyor.
 */
export function positionName(position: string, rawText: string): string {
  if (position.trim()) return position.trim()
  const first = rawText.split("\n").find((s) => s.trim())?.trim() ?? ""
  return first.length > 80 ? `${first.slice(0, 77)}…` : first || "İsimsiz ilan"
}

export function toBoardCard(s: BoardRow): BoardCard {
  return {
    analysisId: s.id,
    position: positionName(s.jobPosting.position, s.jobPosting.rawText),
    score: s.score === null ? null : Math.round(s.score),
    stage: isStage(s.stage) ? s.stage : "saved",
    stageChangedAt: s.stageChangedAt?.toISOString() ?? null,
    noteText: s.note,
    createdAt: s.createdAt.toISOString(),
    adaptation: s.adaptation ? { id: s.adaptation.id, status: s.adaptation.status } : null,
  }
}

/** Kartları sütunlara dağıtır; her sütunda en son hareket eden üstte. */
export function groupByStage(cards: BoardCard[]): Record<Stage, BoardCard[]> {
  const columns = Object.fromEntries(STAGES.map((a) => [a, [] as BoardCard[]])) as Record<
    Stage,
    BoardCard[]
  >
  for (const k of cards) columns[k.stage].push(k)
  const time = (k: BoardCard) => Date.parse(k.stageChangedAt ?? k.createdAt)
  for (const a of STAGES) columns[a].sort((x, y) => time(y) - time(x))
  return columns
}
