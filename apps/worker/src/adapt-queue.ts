export const ADAPT_QUEUE = "adapt"

/**
 * Uyarlama kuyruğunda ön yazı işinin adı; aynı veriyi ({ adaptationId })
 * taşıyor. Burada tanımlı çünkü web katmanı da import ediyor ve bu dosya
 * bağımlılıksız (cover-pipeline.ts core'u çekiyor).
 */
export const COVER_LETTER_JOB = "cover-letter"

/**
 * Kullanıcının anlattığı deneyimden madde yazımı (DOG-94). Katkı kaydı web
 * katmanında taslağa "running" olarak ekleniyor; iş onu dolduruyor.
 */
export const CONTRIBUTION_JOB = "contribution"

export interface ContributionJobData {
  adaptationId: string
  contributionId: string
}

/**
 * Takip mesajı ve teşekkür notu taslağı (DOG-117). Kayıt web katmanında
 * analizin `followUps` dizisine "running" olarak ekleniyor; iş onu dolduruyor.
 */
export const FOLLOW_UP_JOB = "follow-up"

export interface FollowUpJobData {
  analysisId: string
  followUpId: string
}

/** Mülakat hazırlık paketi (DOG-118); kayıt web katmanında "running". */
export const INTERVIEW_PREP_JOB = "interview-prep"

export interface InterviewPrepJobData {
  analysisId: string
}

/** Yazılı mülakat pratiği (DOG-97); deneme hazırlık kaydında "running". */
export const PRACTICE_JOB = "practice"

export interface PracticeJobData {
  analysisId: string
  practiceId: string
}

export interface AdaptJobData {
  /**
   * Uyarlama kaydı web katmanında oluşturuluyor ve kimliği buraya geliyor.
   *
   * Sprint 1'de arayüz BullMQ iş kimliğini yokluyordu; burada olmaz: kararlar
   * ve indirme de aynı kaydı adreslemek zorunda ve iş kimliği kuyruk
   * temizlendiğinde kayboluyor.
   */
  adaptationId: string
}

/** Geçici hatalarda üstel geri çekilmeyle 3 deneme (spec §13). */
export const ADAPT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
