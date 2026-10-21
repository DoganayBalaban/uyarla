/**
 * Uygulama ana ekranının (dashboard) saf mantığı. Başvuru panosuyla aynı
 * kartları okuyor (src/features/applications/board.ts); veritabanına dokunmuyor.
 *
 * Yalnızca kullanıcının kendi verisinden sayım var: ortalama skor artışı
 * ya da "başarı oranı" gibi kanıtsız bir sayı yok (rehber §11).
 */
import { resultPath } from "@/features/analysis/paths"
import { STAGES, type Stage, type BoardCard } from "@/features/applications/board"
import { personalOutcomeSignal } from "@/features/applications/outcomes"

export type PendingKind = "interview" | "decide" | "deadline" | "ready" | "adapt"

export interface PendingItem {
  kind: PendingKind
  analysisId: string
  position: string
  address: string
  /** Mülakat ya da son başvuru günü, "YYYY-AA-GG"; yalnızca tarihli türlerde. */
  date?: string
}

/** Özet kartlarının sayıları (DOG-145). */
export interface DashboardMetrics {
  /** Son 30 günde yapılan analiz. */
  analysesLast30: number
  /** "Kaydedildi" dışındaki her aşama: başvurulmuş. */
  applied: number
  /** Mülakat ya da teklif. */
  positive: number
  /** Skoru olan analizlerin ortalaması, yuvarlanmış; hiç yoksa null. */
  averageScore: number | null
}

/** Grafiğin bir günü: o gün yapılan analiz sayısı ve ortalama skoru. */
export interface TimelinePoint {
  date: string
  analyses: number
  score: number | null
}

export interface DashboardSummary {
  total: number
  stageCounts: Record<Stage, number>
  pending: PendingItem[]
  recentAnalyses: BoardCard[]
  metrics: DashboardMetrics
  /** Son TIMELINE_DAYS gün, eskiden yeniye; her gün bir nokta. */
  timeline: TimelinePoint[]
  /** Kendi sonuçların (DOG-124); en az üç sonuçlanan başvuruda. */
  outcomeSignal: string[] | null
}

const PENDING_ORDER: Record<PendingKind, number> = { interview: 0, decide: 1, deadline: 2, ready: 3, adapt: 4 }
const RECENT_ANALYSIS_LIMIT = 5
const PENDING_LIMIT = 5
export const TIMELINE_DAYS = 90
/** Mülakat ve son başvuru günü bu kadar gün içindeyse "bekleyenler"de. */
const SOON_DAYS = 7
const DAY = 86_400_000

/** Takvim günü kullanıcının saatiyle; sunucu UTC'de çalışıyor. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" })
export const dayOf = (d: Date): string => DAY_FORMAT.format(d)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY)

/**
 * Bir kart kullanıcıdan ne bekliyor:
 * - decide: uyarlamada işaretli maddeler var; karar verilmeden indirme kapalı.
 *   Aşamadan bağımsız, çünkü CV hâlâ indirilemiyor.
 * - ready: CV hazır ama ilana henüz başvurulmadı.
 * - adapt: skor alındı, uyarlanmadı, başvurulmadı.
 * - interview: mülakat günü bir hafta içinde (DOG-145).
 * - deadline: henüz başvurulmadı, son başvuru günü bir hafta içinde (DOG-145).
 */
function pendingFor(k: BoardCard, today: string): PendingItem | null {
  const soon = (date: string | null): date is string => {
    if (!date) return false
    const d = daysBetween(today, date)
    return d >= 0 && d <= SOON_DAYS
  }
  if (k.stage === "interview" && soon(k.interviewAt)) {
    return {
      kind: "interview",
      analysisId: k.analysisId,
      position: k.position,
      address: `/applications/${k.analysisId}/mulakat`,
      date: k.interviewAt,
    }
  }
  const adaptationStatus = k.adaptation?.status
  if (k.adaptation && adaptationStatus === "draft") {
    return { kind: "decide", analysisId: k.analysisId, position: k.position, address: `/adapt/${k.adaptation.id}` }
  }
  if (k.stage !== "saved") return null
  if (soon(k.deadline)) {
    return { kind: "deadline", analysisId: k.analysisId, position: k.position, address: `/applications/${k.analysisId}`, date: k.deadline }
  }
  if (k.adaptation && adaptationStatus === "ready") {
    return { kind: "ready", analysisId: k.analysisId, position: k.position, address: `/adapt/${k.adaptation.id}` }
  }
  if (!k.adaptation) {
    return { kind: "adapt", analysisId: k.analysisId, position: k.position, address: resultPath(k.analysisId) }
  }
  return null
}

const time = (k: BoardCard) => Date.parse(k.createdAt)

export function summarize(cards: BoardCard[], now = new Date()): DashboardSummary {
  const today = dayOf(now)
  const stageCounts = Object.fromEntries(STAGES.map((a) => [a, 0])) as Record<Stage, number>
  for (const k of cards) stageCounts[k.stage]++

  const newestFirst = [...cards].sort((x, y) => time(y) - time(x))
  const pending = newestFirst
    .map((k) => pendingFor(k, today))
    .filter((b): b is PendingItem => b !== null)
    // Sıralama kararlı: aynı türde en yeni analiz önde kalıyor.
    .sort((x, y) => PENDING_ORDER[x.kind] - PENDING_ORDER[y.kind])
    .slice(0, PENDING_LIMIT)

  const scores = cards.map((k) => k.score).filter((n): n is number => n !== null)
  const metrics: DashboardMetrics = {
    analysesLast30: cards.filter((k) => daysBetween(dayOf(new Date(k.createdAt)), today) < 30).length,
    applied: cards.length - stageCounts.saved,
    positive: stageCounts.interview + stageCounts.offer,
    averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  }

  return {
    total: cards.length,
    stageCounts,
    pending,
    recentAnalyses: newestFirst.slice(0, RECENT_ANALYSIS_LIMIT),
    metrics,
    timeline: timeline(cards, today),
    outcomeSignal: personalOutcomeSignal(cards),
  }
}

/** Son TIMELINE_DAYS günün analizleri; analiz olmayan gün de bir nokta. */
function timeline(cards: BoardCard[], today: string): TimelinePoint[] {
  const byDay = new Map<string, number[]>()
  const counts = new Map<string, number>()
  for (const k of cards) {
    const day = dayOf(new Date(k.createdAt))
    counts.set(day, (counts.get(day) ?? 0) + 1)
    if (k.score !== null) byDay.set(day, [...(byDay.get(day) ?? []), k.score])
  }
  const end = Date.parse(today)
  return Array.from({ length: TIMELINE_DAYS }, (_, i) => {
    const date = new Date(end - (TIMELINE_DAYS - 1 - i) * DAY).toISOString().slice(0, 10)
    const s = byDay.get(date)
    return {
      date,
      analyses: counts.get(date) ?? 0,
      score: s ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null,
    }
  })
}

/**
 * Grafiğin 3 aylık görünümünde günler haftaya toplanıyor; günlük 90 nokta seyrek veride
 * dikenli bir çizgi çiziyordu. Haftanın skoru, analiz sayısıyla ağırlıklı.
 */
export function bucketTimeline(points: TimelinePoint[], size: number): TimelinePoint[] {
  if (size <= 1) return points
  const out: TimelinePoint[] = []
  for (let i = points.length; i > 0; i -= size) {
    const week = points.slice(Math.max(0, i - size), i)
    const analyses = week.reduce((n, p) => n + p.analyses, 0)
    const scored = week.filter((p) => p.score !== null)
    const weight = scored.reduce((n, p) => n + p.analyses, 0)
    out.unshift({
      date: week[0]!.date,
      analyses,
      score: weight ? Math.round(scored.reduce((n, p) => n + p.score! * p.analyses, 0) / weight) : null,
    })
  }
  return out
}
