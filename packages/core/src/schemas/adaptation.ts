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

/**
 * Yazımda ilanın terimine çevrilen bir ifade ve maddedeki dayanağı (K-38).
 * Kullanıcıya "SSR terimi senin 'sunucu tarafı render' ifadene dayanıyor"
 * diye gösteriliyor.
 */
export const TermAlignmentSchema = z.object({
  term: z.string(),
  basis: z.string(),
})

export const AdaptedSummarySchema = z.object({
  original: z.string().nullable(),
  rewritten: z.string(),
  verification: VerificationSchema,
  decision: z.enum(["accepted", "rejected"]),
  /** Yeni hâli kullanıcı elle yazdı (DOG-92). */
  edited: z.boolean().optional(),
})

export const AdaptedBulletSchema = z.object({
  /** Kararların adreslenmesi için kararlı kimlik. */
  id: z.string(),
  /**
   * Hangi iş deneyiminin ya da projenin maddesi olduğu; ikisinden biri dolu.
   * projectIndex sonradan eklendi (DOG-105); ondan önceki taslaklarda
   * yalnızca experienceIndex var.
   */
  experienceIndex: z.number().int().nonnegative().optional(),
  projectIndex: z.number().int().nonnegative().optional(),
  original: z.string(),
  /** Ham CV metnindeki birebir karşılık; doğrulamanın kaynağı (Sprint 1). */
  sourceRef: z.string(),
  rewritten: z.string(),
  verification: VerificationSchema,
  /**
   * Doğrulanmış terim uyumları. Bu alandan önce kaydedilmiş taslaklarda
   * yok; okuyan kod boş diziye düşmeli.
   */
  alignments: z.array(TermAlignmentSchema).optional(),
  /**
   * "pending" yalnızca uyarı taşıyan maddelerde olur ve indirmeyi bloklar
   * (K-26).
   */
  decision: z.enum(["accepted", "rejected", "pending"]),
  /** Yeni hâli kullanıcı elle yazdı (DOG-92). */
  edited: z.boolean().optional(),
})

/**
 * Kullanıcının bir eksik gereksinim için anlattığı deneyimden yazılan madde
 * (DOG-94). Ayrı listede: `bullets` kimlikleri konumdan geliyor
 * ("deneyim-madde") ve CV'deki maddelerle birebir eşleşmeli.
 *
 * `answer` doğrulamanın kaynağı ve indirilen belgede maddenin sourceRef'i.
 */
export const ContributionSchema = z.object({
  id: z.string(),
  /** Analizdeki gereksinimin sırası (posting.requirements). */
  requirementIndex: z.number().int().nonnegative(),
  /** Maddenin ekleneceği iş deneyimi. */
  experienceIndex: z.number().int().nonnegative(),
  answer: z.string(),
  status: z.enum(["running", "done", "failed"]),
  /** Yazılan madde; yazım sürerken ya da cevap deneyim anlatmıyorsa boş. */
  text: z.string().optional(),
  verification: VerificationSchema.optional(),
  /** Doğrulanmış terim uyumları; dayanak kullanıcının cevabından. */
  alignments: z.array(TermAlignmentSchema).optional(),
  /** Uyarısız ve uyumsuzsa "accepted"; değilse "pending", indirmeyi bloklar (K-26). */
  decision: z.enum(["accepted", "rejected", "pending"]),
  /**
   * Kullanıcı Hesabım'dan "unut" dedi (DOG-116): sonraki analizlerde olgu
   * sayılmıyor. Bu uyarlamanın kendi belgesi değişmiyor.
   */
  forgotten: z.boolean().optional(),
})

export const AdaptationDraftSchema = z.object({
  summary: AdaptedSummarySchema,
  bullets: z.array(AdaptedBulletSchema),
  /** İlana göre sıralanmış beceri listesi (eklenenler dahil). */
  skillOrder: z.array(z.string()),
  /**
   * CV'nin deneyim maddelerinde geçen, ilanın istediği, ama beceri listesinde
   * olmayan terimler (K-38). K-27 "küme değişmez" diyordu; bu istisna uydurma
   * değil, çünkü terim adayın kendi maddesinde yazıyor. Eski taslaklarda yok.
   */
  addedSkills: z.array(z.string()).optional(),
  /** Kullanıcı katkıları (DOG-94); eski taslaklarda yok. */
  contributions: z.array(ContributionSchema).optional(),
  /**
   * Belge stratejisi (DOG-93): "full" olduğu gibi, "onePage" sıkı yerleşim
   * ve gerekirse `omitted`. Eski taslaklarda yok (= full).
   */
  layout: z.enum(["full", "onePage"]).optional(),
  /**
   * Tek sayfa için belgeden çıkarılan madde kimlikleri (bullets'taki id).
   * Plan önerir (adapt/onePage.ts); kullanıcı her birini geri alabilir.
   * Skor ve indirme bu maddeler olmadan hesaplanıyor.
   */
  omitted: z.array(z.string()).optional(),
  /**
   * Kullanıcının düzenlediği başlık satırı (DOG-92, DOG-134): adının altındaki
   * satır. Uyarlama başlığı kendiliğinden değiştirmiyor; yalnızca kullanıcı
   * yazıyor. Doğrulama maddelerdeki gibi: CV'de olmayan ilan terimi "kontrol
   * et" uyarısı alıyor ama engellenmiyor. Yoksa CV'nin kendi başlığı.
   */
  headline: z.object({ text: z.string(), verification: VerificationSchema }).optional(),
  /**
   * Kullanıcının yazdığı yeni maddeler (DOG-92). Kimlik "u<n>"; CV'deki
   * maddelerin konumdan gelen kimlikleriyle çakışmıyor. Doğrulama
   * düzenlemedeki gibi: uyarı var, engel yok.
   */
  userBullets: z
    .array(z.object({ id: z.string(), experienceIndex: z.number().int().nonnegative(), text: z.string(), verification: VerificationSchema }))
    .optional(),
  /**
   * Kullanıcının belgeden kaldırdığı maddeler (DOG-92). Tek sayfa
   * `omitted`'ından ayrı: strateji değişince sıfırlanmıyor.
   */
  removed: z.array(z.string()).optional(),
  /** İş başına madde sırası (DOG-92); anahtar deneyim sırası. Yoksa doğal sıra. */
  bulletOrder: z.record(z.string(), z.array(z.string())).optional(),
})

export type TermAlignment = z.infer<typeof TermAlignmentSchema>
export type VerificationIssue = z.infer<typeof VerificationIssueSchema>
export type Verification = z.infer<typeof VerificationSchema>
export type AdaptedSummary = z.infer<typeof AdaptedSummarySchema>
export type AdaptedBullet = z.infer<typeof AdaptedBulletSchema>
export type AdaptationDraft = z.infer<typeof AdaptationDraftSchema>
export type Contribution = z.infer<typeof ContributionSchema>

/** Uyarı taşıyan ve henüz karara bağlanmamış madde var mı. */
export function hasPendingDecisions(draft: AdaptationDraft): boolean {
  return (
    draft.bullets.some((b) => b.decision === "pending") ||
    (draft.contributions ?? []).some((c) => c.status === "done" && c.decision === "pending")
  )
}
