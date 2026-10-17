import { buildContribution, resumeLanguage } from "@uyarla/core"
import type { EmbeddingProvider, LlmProvider } from "@uyarla/core"
import type { AdaptationStore } from "./adapt-types.js"

export { CONTRIBUTION_JOB } from "./adapt-queue.js"

export interface ContributionDeps {
  llm: LlmProvider
  embedding: EmbeddingProvider
  store: Pick<AdaptationStore, "getAdaptationContext" | "getDraft" | "updateContribution">
}

/**
 * Kullanıcının bir gereksinim için anlattığı deneyimi maddeye çevirir
 * (DOG-94). Kaynak ve doğrulamanın dayanağı kullanıcının cevabı; CV dili
 * korunuyor. Cevap deneyim anlatmıyorsa katkı boş metinle "done" oluyor,
 * arayüz bunu "maddeye çeviremedik" diye söylüyor.
 */
export async function runContribution(
  deps: ContributionDeps,
  input: { adaptationId: string; contributionId: string },
): Promise<void> {
  const [{ profile, posting }, draft] = await Promise.all([
    deps.store.getAdaptationContext(input.adaptationId),
    deps.store.getDraft(input.adaptationId),
  ])
  const contribution = draft.contributions?.find((c) => c.id === input.contributionId)
  // Yeniden denenen iş zaten bitmiş bir katkıyı bir daha yazmasın.
  if (!contribution || contribution.status !== "running") return

  const requirement = posting.requirements[contribution.requirementIndex]
  if (!requirement) {
    await deps.store.updateContribution(input.adaptationId, input.contributionId, { status: "failed" })
    return
  }

  const built = await buildContribution(deps.llm, deps.embedding, {
    requirement,
    answer: contribution.answer,
    posting,
    language: resumeLanguage(profile),
  })

  await deps.store.updateContribution(input.adaptationId, input.contributionId, {
    status: "done",
    text: built.text,
    alignments: built.alignments,
    verification: built.verification,
    decision: built.decision,
  })
}
