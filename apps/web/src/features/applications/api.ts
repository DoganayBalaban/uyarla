import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { BoardCard, Stage } from "@/features/applications/board"

export interface CardChange {
  stage?: Stage
  note?: string
}

export const applicationsQueryKey = ["applications"] as const

export async function getApplicationCards(): Promise<BoardCard[]> {
  return (await api.get<{ cards: BoardCard[] }>("/applications")).data.cards
}

export async function updateCard(analysisId: string, change: CardChange): Promise<void> {
  await api.patch(`/applications/${encodeURIComponent(analysisId)}`, change)
}

/** Değişikliği kartlara uygular; iyimser güncellemede sunucu yanıtı beklenmeden. */
export function applyCardChange(cards: BoardCard[], analysisId: string, change: CardChange, now = new Date()): BoardCard[] {
  return cards.map((k) =>
    k.analysisId === analysisId
      ? {
          ...k,
          ...(change.stage && { stage: change.stage, stageChangedAt: now.toISOString() }),
          ...(change.note !== undefined && { noteText: change.note || null }),
        }
      : k,
  )
}

export function useApplicationCards() {
  return useQuery({ queryKey: applicationsQueryKey, queryFn: getApplicationCards })
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
