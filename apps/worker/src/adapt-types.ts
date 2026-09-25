import type {
  AdaptationDraft,
  EmbeddingProvider,
  JobPostingData,
  LlmProvider,
  ResumeProfile,
  ScoreResult,
} from "@uyarla/core"

/** Uyarlamanın dayandığı, Sprint 1'de üretilmiş veri. */
export interface AdaptationContext {
  profile: ResumeProfile
  posting: JobPostingData
  result: ScoreResult
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
}

/** Arayüzdeki ilerleme metinleri bu aşamalara karşılık geliyor. */
export type AdaptStage = "yeniden_yaziliyor" | "kontrol_ediliyor" | "tamamlandi"

export interface AdaptPipelineDeps {
  llm: LlmProvider
  embedding: EmbeddingProvider
  store: AdaptationStore
  onProgress?: (stage: AdaptStage) => void
  /** Test edilebilirlik için; üretimde Date.now. */
  now?: () => number
}
