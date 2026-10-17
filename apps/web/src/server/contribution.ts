import {
  MAX_ANSWER_LENGTH,
  MIN_ANSWER_LENGTH,
  type AdaptationDraft,
  type Contribution,
  type JobPostingData,
  type ResumeProfile,
} from "@uyarla/core"

/** Bir uyarlamada en fazla bu kadar katkı; kötüye kullanıma karşı tavan. */
export const MAX_CONTRIBUTIONS = 10

export type ContributionError =
  | "invalid_requirement"
  | "invalid_experience"
  | "answer_too_short"
  | "answer_too_long"
  | "already_running"
  | "too_many"

export interface ContributionInput {
  requirementIndex: unknown
  experienceIndex: unknown
  answer: unknown
}

/**
 * Yeni katkıyı doğrular ve taslağa "running" olarak ekler (DOG-94).
 * Yazımı worker yapıyor; burada LLM yok. Saf fonksiyon: kilit ve kayıt
 * route'ta.
 */
export function addContribution(
  draft: AdaptationDraft,
  profile: ResumeProfile,
  posting: JobPostingData,
  input: ContributionInput,
  id: string,
): { draft: AdaptationDraft; contribution: Contribution } | { error: ContributionError } {
  const { requirementIndex, experienceIndex } = input
  if (typeof requirementIndex !== "number" || !Number.isInteger(requirementIndex) || !posting.requirements[requirementIndex]) {
    return { error: "invalid_requirement" }
  }
  if (typeof experienceIndex !== "number" || !Number.isInteger(experienceIndex) || !profile.experience[experienceIndex]) {
    return { error: "invalid_experience" }
  }
  const answer = typeof input.answer === "string" ? input.answer.trim() : ""
  if (answer.length < MIN_ANSWER_LENGTH) return { error: "answer_too_short" }
  if (answer.length > MAX_ANSWER_LENGTH) return { error: "answer_too_long" }

  const existing = draft.contributions ?? []
  if (existing.some((c) => c.status === "running" && c.requirementIndex === requirementIndex)) {
    return { error: "already_running" }
  }
  if (existing.length >= MAX_CONTRIBUTIONS) return { error: "too_many" }

  const contribution: Contribution = { id, requirementIndex, experienceIndex, answer, status: "running", decision: "pending" }
  return { draft: { ...draft, contributions: [...existing, contribution] }, contribution }
}

/** Kullanıcıya gösterilen mesajlar (marka rehberi §6: suçlamayan, yol gösteren). */
export const CONTRIBUTION_ERROR_MESSAGE: Record<ContributionError, string> = {
  invalid_requirement: "Bu gereksinimi bulamadık. Sayfayı yenileyip tekrar dener misin?",
  invalid_experience: "Hangi işte yaptığını seçer misin?",
  answer_too_short: `Biraz daha anlatır mısın? En az ${MIN_ANSWER_LENGTH} karakter: ne yaptın, hangi araçla, sonuç ne oldu.`,
  answer_too_long: `Kısaltır mısın? En fazla ${MAX_ANSWER_LENGTH} karakter.`,
  already_running: "Bu gereksinim için yazdığımız madde hâlâ hazırlanıyor.",
  too_many: `Bir uyarlamaya en fazla ${MAX_CONTRIBUTIONS} madde ekleyebilirsin.`,
}
