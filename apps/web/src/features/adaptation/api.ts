import { useQuery } from "@tanstack/react-query"
import type { CoverLetterRecord } from "@uyarla/core"
import { api } from "@/lib/api"
import type { AdaptationState } from "@/features/adaptation/types"

/** Analizden uyarlama başlatır; aynı analizin uyarlaması varsa onu döndürür. */
export async function startAdaptation(analysisId: string): Promise<{ adaptationId: string }> {
  return (await api.post<{ adaptationId: string }>("/adapt", { analysisId })).data
}

export async function getAdaptation(id: string): Promise<AdaptationState> {
  return (await api.get<AdaptationState>(`/adapt/${encodeURIComponent(id)}`)).data
}

/** Bir maddeyi kabul ya da reddeder; yanıt güncel taslak ve skor. */
export async function decide(
  id: string,
  itemId: string,
  decision: "accepted" | "rejected",
): Promise<Partial<AdaptationState>> {
  return (await api.patch<Partial<AdaptationState>>(`/adapt/${encodeURIComponent(id)}/decision`, { itemId, decision }))
    .data
}

export async function requestCoverLetter(id: string): Promise<{ coverLetter: CoverLetterRecord }> {
  return (await api.post<{ coverLetter: CoverLetterRecord }>(`/adapt/${encodeURIComponent(id)}/cover-letter`)).data
}

export async function downloadAdaptation(id: string, format: "pdf" | "docx"): Promise<Blob> {
  return (await api.get<Blob>(`/adapt/${encodeURIComponent(id)}/download`, { params: { format }, responseType: "blob" }))
    .data
}

export const adaptationQueryKey = (id: string) => ["adaptation", id] as const

/**
 * Bir sonraki yoklamaya kadar beklenecek süre; false yoklamayı durdurur.
 * Taslak yazılırken sık, yalnızca ön yazı sürerken daha seyrek soruluyor.
 * İstek başarısızsa duruyor: uyarlama yok ya da kullanıcının değil.
 */
export function adaptationPollDelay(
  data: Pick<AdaptationState, "status" | "coverLetter"> | undefined,
  error: unknown,
): number | false {
  if (error) return false
  if (!data || data.status === "running") return 1500
  if (data.coverLetter?.status === "running") return 2000
  return false
}

/**
 * Uyarlamanın durumu ve taslağı. Uyarlama ekranı ve ön yazı bölümü aynı
 * önbelleği paylaşıyor; yoklama, iş sürdükçe kendiliğinden devam ediyor.
 */
export function useAdaptation(id: string) {
  return useQuery({
    queryKey: adaptationQueryKey(id),
    queryFn: () => getAdaptation(id),
    refetchInterval: (query) => adaptationPollDelay(query.state.data, query.state.error),
  })
}
