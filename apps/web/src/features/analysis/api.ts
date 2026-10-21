import { useQuery } from "@tanstack/react-query"
import { api, apiStatus } from "@/lib/api"
import type { ExclusionReason } from "@uyarla/core/score/exclusions"
import type { ScoreResultView } from "@/features/analysis/components/ScoreResult"
import type { PlatformId } from "@/features/analysis/platforms"

export type JobStatus = "running" | "completed" | "failed"

/** `GET /api/analyze/[id]` ve `GET /api/analysis/[id]` yanıtı. */
export interface AnalysisResponse {
  status: JobStatus
  stage?: string
  analysisId?: string | null
  score?: number | null
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  error?: string
  result?: ScoreResultView | null
  /** İlan adresinden tanınan platform (DOG-95). */
  platform?: PlatformId | null
  /** Bilinmeyen ya da taklit ilan adresi uyarısı (DOG-125). */
  sourceWarning?: { tone: "soft" | "strong"; text: string } | null
  /** İlanın kullanıcının yapıştırdığı metni (DOG-133). */
  postingText?: string | null
}

export interface PostingFromUrl {
  text?: string
  position?: string | null
}

/** İlan bağlantısındaki metni sunucu üzerinden çeker. */
export async function fetchPostingFromUrl(url: string): Promise<PostingFromUrl> {
  return (await api.post<PostingFromUrl>("/job-url", { url })).data
}

/**
 * CV ve ilanı kuyruğa koyar; iş kimliği yoklamada kullanılıyor.
 * `savedToLibrary` yalnızca "kütüphaneme kaydet" istendiğinde geliyor.
 */
export async function startAnalysis(form: FormData): Promise<{ jobId: string; savedToLibrary?: boolean }> {
  return (await api.post<{ jobId: string; savedToLibrary?: boolean }>("/analyze", form)).data
}

export async function getAnalysisJob(jobId: string): Promise<AnalysisResponse> {
  return (await api.get<AnalysisResponse>(`/analyze/${encodeURIComponent(jobId)}`)).data
}

/** Bitmiş analizin kalıcı sonucu. */
export async function getAnalysis(analysisId: string): Promise<AnalysisResponse> {
  return (await api.get<AnalysisResponse>(`/analysis/${encodeURIComponent(analysisId)}`)).data
}

/** Gereksinim satırındaki işlem (DOG-90): işaretle, işareti kaldır ya da ilanın şartını düzelt. */
export type RequirementAction =
  | { action: "exclude"; reason: ExclusionReason; always: boolean }
  | { action: "include" }
  | { action: "correct"; minYears?: number | null; terms?: string[] | null }

export async function updateRequirement(
  analysisId: string,
  requirementIndex: number,
  change: RequirementAction,
): Promise<{ result: ScoreResultView; score: number }> {
  return (
    await api.patch<{ result: ScoreResultView; score: number }>(`/analysis/${encodeURIComponent(analysisId)}`, {
      requirementIndex,
      ...change,
    })
  ).data
}

export const analysisQueryKey = (analysisId: string) => ["analysis", analysisId] as const

/**
 * Bir sonraki yoklamaya kadar beklenecek süre; false yoklamayı durdurur.
 * İş bitince ya da API işi tanımayınca (404/401) duruyor; yanıt hiç
 * gelmediyse (ağ kesintisi) sürüyor.
 */
export function jobPollDelay(
  data: Pick<AnalysisResponse, "status"> | undefined,
  errorStatus: number | null,
  intervalMs: number,
): number | false {
  if (errorStatus !== null) return false
  if (data?.status === "completed" || data?.status === "failed") return false
  return intervalMs
}

/**
 * Süren analizi yoklar. Analiz sayfası ve sağ alttaki bildirim aynı anahtarı
 * kullanıyor: sayfa değişince bildirim son yanıtı önbellekten devralıyor.
 * jobId null ise istek gitmiyor.
 */
export function useAnalysisJob(jobId: string | null, intervalMs: number) {
  return useQuery({
    queryKey: ["analysis-job", jobId],
    queryFn: () => getAnalysisJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => jobPollDelay(query.state.data, apiStatus(query.state.error), intervalMs),
    // Yoklamada ağ kesintisi bir sonraki turda zaten tekrar deneniyor.
    retry: false,
    gcTime: 60_000,
  })
}
