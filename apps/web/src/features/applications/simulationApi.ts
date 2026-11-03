import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SimulationRecord } from "@uyarla/core/interview/simulationRecord"
import { api } from "@/lib/api"
import type { SimulationRequest } from "@/features/applications/schema"

export interface SimulationData {
  position: string
  company: string | null
  language: string
  /** Analiz bitmeden görüşme başlamıyor. */
  ready: boolean
  simulations: SimulationRecord[]
  simulationsLeft: number
}

export const simulationKey = (analysisId: string) => ["interview-simulation", analysisId] as const

/**
 * Yoklama (DOG-172): görüşmeci ya da rapor yazılırken sık, adayın sırasında
 * ve görüşme bitince yok. Düşen adımda da yok; kullanıcı yeniden deniyor.
 */
export function simulationPollDelay(data: SimulationData | undefined): number | false {
  const writing = data?.simulations.some((s) => !s.failed && (s.phase === "interviewer" || s.phase === "report"))
  return writing ? 1200 : false
}

export function useSimulations(analysisId: string) {
  return useQuery({
    queryKey: simulationKey(analysisId),
    queryFn: async () => (await api.get<SimulationData>(`/applications/${encodeURIComponent(analysisId)}/simulations`)).data,
    refetchInterval: (q) => simulationPollDelay(q.state.data),
  })
}

/** Ekrandaki kaydı sunucunun döndürdüğüyle değiştirir; yeni görüşme sona ekleniyor. */
export function withSimulation(data: SimulationData, simulation: SimulationRecord): SimulationData {
  const exists = data.simulations.some((s) => s.id === simulation.id)
  // Yeni görüşme hiç başlamadan düşmüş bir öncekinin yerini alıyor (server/simulations).
  const kept = exists ? data.simulations : data.simulations.filter((s) => !(s.failed && s.messages.length === 0))
  return {
    ...data,
    simulations: exists ? kept.map((s) => (s.id === simulation.id ? simulation : s)) : [...kept, simulation],
  }
}

/** Başlat, cevap ver, bitir, yeniden dene; yanıt beklenmeden ekranda. */
export function useSimulationAction(analysisId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: SimulationRequest) =>
      (await api.post<{ simulation: SimulationRecord }>(`/applications/${encodeURIComponent(analysisId)}/simulations`, body)).data.simulation,
    onSuccess: (simulation) => {
      queryClient.setQueryData<SimulationData>(simulationKey(analysisId), (old) => (old ? withSimulation(old, simulation) : old))
      void queryClient.invalidateQueries({ queryKey: simulationKey(analysisId) })
    },
  })
}
