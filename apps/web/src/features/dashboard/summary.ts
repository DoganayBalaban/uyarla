/**
 * Uygulama ana ekranının (dashboard) saf mantığı. Başvuru panosuyla aynı
 * kartları okuyor (src/features/applications/board.ts); veritabanına dokunmuyor.
 *
 * Yalnızca kullanıcının kendi verisinden sayım var: ortalama skor artışı
 * ya da "başarı oranı" gibi kanıtsız bir sayı yok (rehber §11).
 */
import { resultPath } from "@/features/analysis/activeAnalysis"
import { STAGES, type Stage, type BoardCard } from "@/features/applications/board"

export type PendingKind = "decide" | "ready" | "adapt"

export interface PendingItem {
  kind: PendingKind
  analysisId: string
  position: string
  address: string
}

export interface DashboardSummary {
  total: number
  stageCounts: Record<Stage, number>
  pending: PendingItem[]
  recentAnalyses: BoardCard[]
}

const PENDING_ORDER: Record<PendingKind, number> = { decide: 0, ready: 1, adapt: 2 }
const RECENT_ANALYSIS_LIMIT = 5
const PENDING_LIMIT = 4

/**
 * Bir kart kullanıcıdan ne bekliyor:
 * - decide: uyarlamada işaretli maddeler var; karar verilmeden indirme kapalı.
 *   Aşamadan bağımsız, çünkü CV hâlâ indirilemiyor.
 * - ready: CV hazır ama ilana henüz başvurulmadı.
 * - adapt: skor alındı, uyarlanmadı, başvurulmadı.
 */
function pendingFor(k: BoardCard): PendingItem | null {
  const adaptationStatus = k.adaptation?.status
  if (k.adaptation && adaptationStatus === "draft") {
    return { kind: "decide", analysisId: k.analysisId, position: k.position, address: `/adapt/${k.adaptation.id}` }
  }
  if (k.stage !== "saved") return null
  if (k.adaptation && adaptationStatus === "ready") {
    return { kind: "ready", analysisId: k.analysisId, position: k.position, address: `/adapt/${k.adaptation.id}` }
  }
  if (!k.adaptation) {
    return { kind: "adapt", analysisId: k.analysisId, position: k.position, address: resultPath(k.analysisId) }
  }
  return null
}

const time = (k: BoardCard) => Date.parse(k.createdAt)

export function summarize(cards: BoardCard[]): DashboardSummary {
  const stageCounts = Object.fromEntries(STAGES.map((a) => [a, 0])) as Record<Stage, number>
  for (const k of cards) stageCounts[k.stage]++

  const newestFirst = [...cards].sort((x, y) => time(y) - time(x))
  const pending = newestFirst
    .map(pendingFor)
    .filter((b): b is PendingItem => b !== null)
    // Sıralama kararlı: aynı türde en yeni analiz önde kalıyor.
    .sort((x, y) => PENDING_ORDER[x.kind] - PENDING_ORDER[y.kind])
    .slice(0, PENDING_LIMIT)

  return {
    total: cards.length,
    stageCounts,
    pending,
    recentAnalyses: newestFirst.slice(0, RECENT_ANALYSIS_LIMIT),
  }
}
