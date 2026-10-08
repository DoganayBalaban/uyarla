import type {
  AdaptationDraft,
  CandidateIntent,
  EmbeddingProvider,
  JobPostingData,
  LlmProvider,
  CoverLetterRecord,
  ResumeProfile,
  ScoreResult,
} from "@uyarla/core"

/** Uyarlamanın dayandığı, Sprint 1'de üretilmiş veri. */
export interface AdaptationContext {
  profile: ResumeProfile
  posting: JobPostingData
  result: ScoreResult
  /** Uyarlamanın sahibinin onboarding amacı; ön yazının vurgusu buna göre (DOG-55). */
  intent?: CandidateIntent
}

/**
 * Hattın ihtiyaç duyduğu kalıcılık işlemleri.
 *
 * Prisma doğrudan çağrılmıyor: hat böylece veritabanı olmadan test
 * edilebiliyor (Sprint 1'deki AnalysisStore ile aynı gerekçe).
 */
export interface AdaptationStore {
  getAdaptationContext(adaptationId: string): Promise<AdaptationContext>
  saveDraft(input: {
    adaptationId: string
    draft: AdaptationDraft
    status: "draft" | "ready"
    durationMs: number
    tokenUsage: number
  }): Promise<void>
  failAdaptation(adaptationId: string, errorClass: string): Promise<void>
  saveCoverLetter(adaptationId: string, value: CoverLetterRecord): Promise<void>
}

/** Arayüzdeki ilerleme metinleri bu aşamalara karşılık geliyor. */
export type AdaptStage = "rewriting" | "verifying" | "completed"

export interface AdaptPipelineDeps {
  llm: LlmProvider
  embedding: EmbeddingProvider
  store: AdaptationStore
  onProgress?: (stage: AdaptStage) => void
  /** Test edilebilirlik için; üretimde Date.now. */
  now?: () => number
}
