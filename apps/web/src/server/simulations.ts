import {
  MAX_SIMULATIONS_PER_APPLICATION,
  type SimulationRecord,
} from "@uyarla/core/interview/simulationRecord"

export type SimulationError = "too_many" | "active_exists" | "not_found" | "not_your_turn" | "finished" | "not_failed"

export const SIMULATION_ERROR_MESSAGE: Record<SimulationError, string> = {
  too_many: `Bir başvuru için en fazla ${MAX_SIMULATIONS_PER_APPLICATION} simülasyon yapabiliyorsun.`,
  active_exists: "Süren bir görüşmen var; önce onu bitir.",
  not_found: "Bu görüşmeyi bulamadık; sayfayı yenile.",
  not_your_turn: "Deniz hâlâ yazıyor; biraz bekle.",
  finished: "Bu görüşme bitti.",
  not_failed: "Görüşme zaten sürüyor.",
}

type Outcome = { list: SimulationRecord[]; simulation: SimulationRecord } | { error: SimulationError }

/** Başarısız açılış hak yemiyor: görüşme hiç başlamadı. */
const counts = (s: SimulationRecord) => !(s.failed && s.messages.length === 0)

export function simulationsLeft(list: SimulationRecord[]): number {
  return Math.max(0, MAX_SIMULATIONS_PER_APPLICATION - list.filter(counts).length)
}

/**
 * Yeni görüşme (DOG-172): görüşmeci açılışı yazacak. Aynı anda bir görüşme;
 * hiç başlamadan düşen bir önceki görüşme yerini yenisine bırakıyor.
 */
export function startSimulation(list: SimulationRecord[], id: string, now: Date): Outcome {
  const kept = list.filter(counts)
  if (kept.some((s) => s.phase !== "done")) return { error: "active_exists" }
  if (simulationsLeft(kept) === 0) return { error: "too_many" }
  const simulation: SimulationRecord = { id, phase: "interviewer", messages: [], createdAt: now.toISOString() }
  return { list: [...kept, simulation], simulation }
}

function change(list: SimulationRecord[], id: string, apply: (s: SimulationRecord) => SimulationRecord | SimulationError): Outcome {
  const current = list.find((s) => s.id === id)
  if (!current) return { error: "not_found" }
  const next = apply(current)
  if (typeof next === "string") return { error: next }
  return { list: list.map((s) => (s.id === id ? next : s)), simulation: next }
}

/** Adayın cevabı; sıra görüşmeciye geçiyor. */
export function addAnswer(list: SimulationRecord[], id: string, text: string, now: Date): Outcome {
  return change(list, id, (s) => {
    if (s.phase === "done" || s.phase === "report") return "finished"
    if (s.phase !== "candidate") return "not_your_turn"
    return { ...s, phase: "interviewer", messages: [...s.messages, { role: "candidate", text, createdAt: now.toISOString() }] }
  })
}

/**
 * Görüşmeyi istediği an bitirir; rapor o ana kadarki cevaplardan. Görüşmeci
 * yazarken de olur: onun yazımı aşama değiştiği için düşüyor.
 */
export function endSimulation(list: SimulationRecord[], id: string): Outcome {
  return change(list, id, (s) => {
    if (s.phase === "done" || s.phase === "report") return "finished"
    const { failed: _failed, ...rest } = s
    return { ...rest, phase: "report" }
  })
}

/** Düşen adımı (görüşmeci mesajı ya da rapor) yeniden kuyruğa koyar. */
export function retrySimulation(list: SimulationRecord[], id: string): Outcome {
  return change(list, id, (s) => {
    if (!s.failed) return "not_failed"
    const { failed: _failed, ...rest } = s
    return rest
  })
}
