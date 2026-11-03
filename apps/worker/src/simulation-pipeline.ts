import { interviewerTurn, simulationReport } from "@uyarla/core"
import type { LlmProvider } from "@uyarla/core"
import type { SimulationJobData } from "./adapt-queue.js"
import type { SimulationStore } from "./follow-up-store.js"

/**
 * Mülakat simülasyonunun bir adımı (DOG-172). Görüşmecinin sırasıysa mesajını
 * yazıyor; veda mesajından sonra ya da kullanıcı görüşmeyi bitirince raporu.
 * Yeniden denenen iş bitmiş bir adımı tekrar yazmıyor: kayıt bu arada
 * değiştiyse (mesaj sayısı, aşama) yazım düşüyor.
 */
export async function runSimulation(
  deps: { llm: LlmProvider; store: SimulationStore; now?: () => Date },
  input: SimulationJobData,
): Promise<void> {
  const now = deps.now ?? (() => new Date())
  const context = await deps.store.getContext(input.analysisId, input.simulationId)
  let simulation = context.simulation
  if (!simulation || simulation.failed) return

  if (simulation.phase === "interviewer") {
    const count = simulation.messages.length
    const { data } = await interviewerTurn(deps.llm, { ...context, messages: simulation.messages }, now())
    const written = await deps.store.update(input.analysisId, input.simulationId, (current) => {
      if (current.phase !== "interviewer" || current.messages.length !== count) return null
      // Adayın son cevabındaki kağıtta olmayan iddialar o mesajın üstünde; ekran gösteriyor.
      const messages = current.messages.map((m, i) =>
        i === count - 1 && m.role === "candidate" && data.lastAnswerOffPaper ? { ...m, offPaper: data.lastAnswerOffPaper } : m,
      )
      return { ...current, messages: [...messages, data.message], phase: data.message.move === "farewell" ? "report" : "candidate" }
    })
    if (!written) return
    simulation = written
  }
  if (simulation.phase !== "report") return

  const { data: report } = await simulationReport(deps.llm, {
    profile: context.profile,
    coverLetter: context.coverLetter,
    posting: context.posting,
    messages: simulation.messages,
  })
  await deps.store.update(input.analysisId, input.simulationId, (current) =>
    current.phase === "report" ? { ...current, phase: "done", report, finishedAt: now().toISOString() } : null,
  )
}
