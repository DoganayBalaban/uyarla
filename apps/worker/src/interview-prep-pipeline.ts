import { generateInterviewPrep } from "@uyarla/core"
import type { LlmProvider } from "@uyarla/core"
import type { InterviewPrepJobData } from "./adapt-queue.js"
import type { InterviewPrepStore } from "./follow-up-store.js"

/**
 * Mülakat hazırlık paketi (DOG-118). Kaynak başvurunun gönderilen hâli;
 * kanıtlar CV'de birebir, STAR ve köprüler doğrulanmış. Yeniden denenen iş
 * bitmiş bir paketi bir daha yazmıyor.
 */
export async function runInterviewPrep(deps: { llm: LlmProvider; store: InterviewPrepStore }, input: InterviewPrepJobData): Promise<void> {
  const context = await deps.store.getPrepContext(input.analysisId)
  if (!context.record || context.record.status !== "running") return
  const { data } = await generateInterviewPrep(deps.llm, {
    profile: context.profile,
    coverLetter: context.coverLetter,
    posting: context.posting,
    missingMust: context.missingMust,
    rewritten: context.rewritten,
  })
  await deps.store.savePrep(input.analysisId, { ...context.record, status: "done", prep: data })
}
