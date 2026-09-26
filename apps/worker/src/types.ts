import type {
  EmbeddingProvider,
  JobPostingData,
  LlmProvider,
  ResumeProfile,
  ScoreResult,
} from "@uyarla/core"

/**
 * Hattın ihtiyaç duyduğu kalıcılık işlemleri.
 *
 * Prisma doğrudan çağrılmıyor: hat böylece veritabanı olmadan test
 * edilebiliyor ve alan mantığı ORM'e bağlanmıyor.
 */
export interface AnalysisStore {
  getResumeText(resumeId: string): Promise<string>
  getJobPostingText(jobPostingId: string): Promise<string>
  saveResumeVersion(resumeId: string, profile: ResumeProfile): Promise<string>
  saveJobPostingData(jobPostingId: string, data: JobPostingData): Promise<void>
  createAnalysis(input: {
    jobPostingId: string
    modelId: string
    /** Sahiplik; yetki kontrolü buna bakıyor (spec §5). */
    userId: string
  }): Promise<string>
  attachResumeVersion(analysisId: string, resumeVersionId: string): Promise<void>
  completeAnalysis(input: {
    analysisId: string
    score: number
    result: ScoreResult
    durationMs: number
    tokenUsage: number
  }): Promise<void>
  failAnalysis(analysisId: string, errorClass: string): Promise<void>
}

/** Arayüzdeki ilerleme metinleri bu aşamalara karşılık geliyor (spec §8). */
export type PipelineStage =
  | "cv_okunuyor"
  | "ilan_okunuyor"
  | "karsilastiriliyor"
  | "tamamlandi"

export interface PipelineDeps {
  llm: LlmProvider
  embedding: EmbeddingProvider
  store: AnalysisStore
  /** Analysis kaydına yazılacak model kimliği (K-03). */
  modelId: string
  onProgress?: (stage: PipelineStage) => void
  /** Test edilebilirlik için; üretimde Date.now. */
  now?: () => number
}

export interface PipelineInput {
  resumeId: string
  jobPostingId: string
  /** Analiz kaydına yazılacak sahip. */
  userId: string
}
