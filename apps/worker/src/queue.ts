export const ANALYZE_QUEUE = "analyze"

export interface AnalyzeJobData {
  resumeId: string
  jobPostingId: string
  /** Analiz kaydının sahibi; web katmanında oturumdan geliyor. */
  userId: string
}

/**
 * Geçici hatalarda üstel geri çekilmeyle 3 deneme (spec §11).
 * Kalıcı hatalarda işçi işi hemen bitiriyor; tekrar denemek anlamsız.
 */
export const ANALYZE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
