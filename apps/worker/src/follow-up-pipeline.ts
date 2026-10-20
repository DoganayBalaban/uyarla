import { generateFollowUp } from "@uyarla/core"
import type { LlmProvider } from "@uyarla/core"
import type { FollowUpJobData } from "./adapt-queue.js"
import type { FollowUpStore } from "./follow-up-store.js"

/**
 * Takip mesajı ve teşekkür notu taslağı (DOG-117). Kaynak başvurunun
 * gönderilen hâli; doğrulama ön yazıyla aynı. Yeniden denenen iş bitmiş bir
 * taslağı bir daha yazmıyor.
 */
export async function runFollowUp(deps: { llm: LlmProvider; store: FollowUpStore }, input: FollowUpJobData): Promise<void> {
  const context = await deps.store.getContext(input.analysisId, input.followUpId)
  if (!context || context.record.status !== "running") return

  const { data } = await generateFollowUp(deps.llm, {
    profile: context.profile,
    coverLetter: context.coverLetter,
    posting: context.posting,
    kind: context.record.kind,
    channel: context.record.channel,
    date: context.date,
  })
  await deps.store.update(input.analysisId, input.followUpId, {
    status: "done",
    subject: data.subject,
    text: data.text,
    verification: data.verification,
  })
}
