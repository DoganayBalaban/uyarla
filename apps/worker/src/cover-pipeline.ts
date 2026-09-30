import { generateCoverLetter } from "@uyarla/core"
import type { LlmProvider } from "@uyarla/core"
import type { AdaptationStore } from "./adapt-types.js"

export { COVER_LETTER_JOB } from "./adapt-queue.js"

export interface CoverLetterDeps {
  llm: LlmProvider
  store: Pick<AdaptationStore, "getAdaptationContext" | "saveCoverLetter">
  now?: () => Date
}

/**
 * Ön yazıyı üretir ve kaydeder. Tek LLM çağrısı; kaynak, uyarlamanın
 * dayandığı CV profili ve ilan (uyarlanmış maddeler değil — kontrolün
 * kaynağı kullanıcının kendi yazdığı olmalı).
 */
export async function runCoverLetter(
  deps: CoverLetterDeps,
  input: { adaptationId: string },
): Promise<void> {
  const { profile, posting } = await deps.store.getAdaptationContext(input.adaptationId)
  const { data, tokens } = await generateCoverLetter(deps.llm, { profile, posting })

  await deps.store.saveCoverLetter(input.adaptationId, {
    status: "done",
    paragraphs: data.paragraphs,
    tokenUsage: tokens,
    createdAt: (deps.now?.() ?? new Date()).toISOString(),
  })
}
