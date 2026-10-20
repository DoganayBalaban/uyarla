import { generateFormAnswer } from "@uyarla/core"
import type { LlmProvider } from "@uyarla/core"
import type { FormAnswerJobData } from "./adapt-queue.js"
import type { FormAnswerStore } from "./follow-up-store.js"

/**
 * Başvuru formu yanıtı (DOG-123). Kaynak başvurunun gönderilen hâli;
 * doğrulama ön yazıyla aynı, sınır kodda. Yeniden denenen iş bitmiş bir
 * yanıtı bir daha yazmıyor.
 */
export async function runFormAnswer(deps: { llm: LlmProvider; store: FormAnswerStore }, input: FormAnswerJobData): Promise<void> {
  const context = await deps.store.getContext(input.analysisId, input.answerId)
  if (!context || context.record.status !== "running") return

  const { data } = await generateFormAnswer(deps.llm, {
    profile: context.profile,
    coverLetter: context.coverLetter,
    posting: context.posting,
    question: context.record.question,
    limit: context.record.limit,
  })
  await deps.store.update(input.analysisId, input.answerId, {
    status: "done",
    text: data.text,
    verification: data.verification,
    overLimit: data.overLimit || undefined,
  })
}
