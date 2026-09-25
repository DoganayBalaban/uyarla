import { z } from "zod"

/**
 * Bir yeniden yazımın uydurma kontrolünden geçip geçmediği.
 *
 * `issues` boşsa `status` "ok" olur. Her sorun kullanıcıya gösterilecek bir
 * gerekçe taşır: "Bu maddede Kubernetes geçiyor ama CV'nde yok" (spec §7.4).
 */
export const VerificationIssueSchema = z.object({
  kind: z.enum(["number_mismatch", "posting_term_injected", "semantic_drift"]),
  /** Kullanıcıya gösterilecek gerekçe. */
  detail: z.string(),
})

export const VerificationSchema = z.object({
  status: z.enum(["ok", "flagged"]),
  issues: z.array(VerificationIssueSchema),
})

export const AdaptedSummarySchema = z.object({
  original: z.string().nullable(),
  rewritten: z.string(),
  verification: VerificationSchema,
  decision: z.enum(["accepted", "rejected"]),
})

export const AdaptedBulletSchema = z.object({
  /** Kararların adreslenmesi için kararlı kimlik. */
  id: z.string(),
  /** Hangi iş deneyiminin maddesi olduğu. */
  experienceIndex: z.number().int().nonnegative(),
  original: z.string(),
  /** Ham CV metnindeki birebir karşılık; doğrulamanın kaynağı (Sprint 1). */
  sourceRef: z.string(),
  rewritten: z.string(),
  verification: VerificationSchema,
  /**
   * "pending" yalnızca uyarı taşıyan maddelerde olur ve indirmeyi bloklar
   * (K-26).
   */
  decision: z.enum(["accepted", "rejected", "pending"]),
})

export const AdaptationDraftSchema = z.object({
  summary: AdaptedSummarySchema,
  bullets: z.array(AdaptedBulletSchema),
  /** İlana göre sıralanmış beceri listesi; küme değişmez (K-27). */
  skillOrder: z.array(z.string()),
})

export type VerificationIssue = z.infer<typeof VerificationIssueSchema>
export type Verification = z.infer<typeof VerificationSchema>
export type AdaptedSummary = z.infer<typeof AdaptedSummarySchema>
export type AdaptedBullet = z.infer<typeof AdaptedBulletSchema>
export type AdaptationDraft = z.infer<typeof AdaptationDraftSchema>

/** Uyarı taşıyan ve henüz karara bağlanmamış madde var mı. */
export function hasPendingDecisions(draft: AdaptationDraft): boolean {
  return draft.bullets.some((b) => b.decision === "pending")
}
