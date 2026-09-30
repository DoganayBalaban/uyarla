export type StageState = "pending" | "active" | "done" | "error"

export interface Stage {
  id: string
  title: string
  description?: string
  status: StageState
}

/**
 * Sıralı aşama kimliklerinden durumları türetir: aktif olandan öncekiler
 * tamam, sonrakiler sırada. Sunucu yalnızca mevcut aşamayı söylüyor.
 */
export function deriveStageStates(
  definitions: Omit<Stage, "status">[],
  activeId: string | null,
  finished = false,
): Stage[] {
  const activeIndex = activeId ? definitions.findIndex((t) => t.id === activeId) : -1
  return definitions.map((t, i) => ({
    ...t,
    status: finished ? "done" : activeIndex === -1 ? (i === 0 ? "active" : "pending") : i < activeIndex ? "done" : i === activeIndex ? "active" : "pending",
  }))
}
