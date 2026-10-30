import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { BoardCard, Stage } from "@/features/applications/board"
import type { FollowUpChannel, FollowUpKind, OutreachPurpose, OutreachRecipient } from "@uyarla/core/cover/followUpRecord"

export interface CardChange {
  stage?: Stage
  note?: string
  /** "YYYY-AA-GG"; null tarihi siler (DOG-98). */
  interviewAt?: string | null
}

export const applicationsQueryKey = ["applications"] as const

export async function getApplicationCards(): Promise<BoardCard[]> {
  return (await api.get<{ cards: BoardCard[] }>("/applications")).data.cards
}

export async function updateCard(analysisId: string, change: CardChange): Promise<void> {
  await api.patch(`/applications/${encodeURIComponent(analysisId)}`, change)
}

/** Başvuruyu tamamen siler (DOG-171); ilan, analiz, uyarlama ve notlarıyla. */
export async function deleteApplication(analysisId: string): Promise<void> {
  await api.delete(`/applications/${encodeURIComponent(analysisId)}`)
}

/** Silinen başvuru panodan hemen düşüyor. */
export function withoutCard(cards: BoardCard[], analysisId: string): BoardCard[] {
  return cards.filter((c) => c.analysisId !== analysisId)
}

/** Silme: kart hemen kalkıyor, hata olursa geri geliyor; panodaki sayılar da yenileniyor. */
export function useDeleteApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (analysisId: string) => deleteApplication(analysisId),
    onMutate: async (analysisId) => {
      await queryClient.cancelQueries({ queryKey: applicationsQueryKey })
      const previous = queryClient.getQueryData<BoardCard[]>(applicationsQueryKey)
      if (previous) queryClient.setQueryData(applicationsQueryKey, withoutCard(previous, analysisId))
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(applicationsQueryKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

/** Değişikliği kartlara uygular; iyimser güncellemede sunucu yanıtı beklenmeden. */
export function applyCardChange(cards: BoardCard[], analysisId: string, change: CardChange, now = new Date()): BoardCard[] {
  return cards.map((k) =>
    k.analysisId === analysisId
      ? {
          ...k,
          ...(change.stage && { stage: change.stage, stageChangedAt: now.toISOString() }),
          ...(change.note !== undefined && { noteText: change.note || null }),
          ...(change.interviewAt !== undefined && { interviewAt: change.interviewAt }),
        }
      : k,
  )
}

/** Takip mesajı ya da teşekkür notu taslağı ister (DOG-117); worker yazıyor. */
/** Takip, teşekkür ya da ağ kurma mesajı isteği (DOG-117, DOG-99). */
export interface FollowUpRequestBody {
  kind: FollowUpKind
  channel: FollowUpChannel
  recipient?: OutreachRecipient
  purpose?: OutreachPurpose
  note?: string
}

export async function requestFollowUp(
  analysisId: string,
  body: FollowUpRequestBody,
): Promise<void> {
  await api.post(`/applications/${encodeURIComponent(analysisId)}`, body)
}

export function useApplicationCards(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: applicationsQueryKey,
    queryFn: getApplicationCards,
    // Kenar çubuğu anonim oturumda sorgulamasın (DOG-144).
    enabled: options.enabled ?? true,
    // Bir taslak yazılırken pano kendini yokluyor (DOG-117).
    refetchInterval: (query) =>
      query.state.data?.some((k) => k.followUps.some((f) => f.status === "running")) ? 2000 : false,
  })
}

export function useRequestFollowUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ analysisId, ...body }: { analysisId: string } & FollowUpRequestBody) => requestFollowUp(analysisId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: applicationsQueryKey }),
  })
}

/** İyimser güncelleme: kart hemen yer değiştiriyor, hata olursa geri alınıyor. */
export function useUpdateCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ analysisId, change }: { analysisId: string; change: CardChange }) => updateCard(analysisId, change),
    onMutate: async ({ analysisId, change }) => {
      await queryClient.cancelQueries({ queryKey: applicationsQueryKey })
      const previous = queryClient.getQueryData<BoardCard[]>(applicationsQueryKey)
      if (previous) queryClient.setQueryData(applicationsQueryKey, applyCardChange(previous, analysisId, change))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(applicationsQueryKey, context.previous)
    },
  })
}
