import { useQuery } from "@tanstack/react-query"
import { api, apiStatus } from "@/lib/api"
import type { ScoreResultView } from "@/features/analysis/components/ScoreResult"

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
}

export interface PostingFromUrl {
  text?: string
  position?: string | null
}

/** İlan bağlantısındaki metni sunucu üzerinden çeker. */
export async function fetchPostingFromUrl(url: string): Promise<PostingFromUrl> {
  return (await api.post<PostingFromUrl>("/job-url", { url })).data
}

/** CV ve ilanı kuyruğa koyar; iş kimliği yoklamada kullanılıyor. */
export async function startAnalysis(form: FormData): Promise<{ jobId: string }> {
  return (await api.post<{ jobId: string }>("/analyze", form)).data
}

export async function getAnalysisJob(jobId: string): Promise<AnalysisResponse> {
  return (await api.get<AnalysisResponse>(`/analyze/${encodeURIComponent(jobId)}`)).data
}

/** Bitmiş analizin kalıcı sonucu. */
export async function getAnalysis(analysisId: string): Promise<AnalysisResponse> {
  return (await api.get<AnalysisResponse>(`/analysis/${encodeURIComponent(analysisId)}`)).data
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
