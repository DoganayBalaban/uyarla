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

/** LinkedIn profil raporu (DOG-69); kayıt `Resume.linkedinReport` içinde "running". */
export const LINKEDIN_REPORT_JOB = "linkedin-report"

export interface LinkedInReportJobData {
  resumeId: string
}

/** Başvuru formu yanıtı (DOG-123); yanıt `Analysis.formAnswers` içinde "running". */
export const FORM_ANSWER_JOB = "form-answer"

export interface FormAnswerJobData {
  analysisId: string
  answerId: string
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

/**
 * Uyarlama işinin kuyruktaki kimliği. Web bekleme ekranı için işin
 * bildirdiği aşamayı (`rewriting`, `verifying`) bu kimlikle okuyor; kayıt
 * kimliği yetmiyor, BullMQ kendi kimliğini üretiyordu.
 */
export function adaptJobId(adaptationId: string): string {
  return `adapt-${adaptationId}`
}

/** Geçici hatalarda üstel geri çekilmeyle 3 deneme (spec §13). */
export const ADAPT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
