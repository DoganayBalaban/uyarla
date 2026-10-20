/**
 * Yazılı pratik kaydının tipleri ve sınırları (DOG-97). Tarayıcı da
 * kullanıyor; doğrulama ve istem koduna bağımlı değil.
 */

export const ANSWER_MIN_WORDS = 80
export const ANSWER_MAX_WORDS = 250
/** Bundan kısa cevap değerlendirilemez; LLM'e gitmiyor. */
export const ANSWER_MIN_LENGTH = 30
export const ANSWER_MAX_LENGTH = 3000

/** Bir soruya en çok bu kadar geri bildirim. */
export const MAX_PRACTICE_PER_QUESTION = 3

export interface PracticeFeedback {
  star: { situation: boolean; task: boolean; action: boolean; result: boolean }
  strengths: string[]
  improvements: string[]
  words: number
  length: "short" | "ok" | "long"
  /** Cevapta geçen ama CV'de olmayan sayı ya da ilan terimi. */
  offPaper: string[]
}

/** Yazılı pratik denemesi; hazırlık kaydının içinde. */
export interface PracticeEntry {
  id: string
  questionIndex: number
  answer: string
  status: "running" | "done" | "failed"
  feedback?: PracticeFeedback
  createdAt: string
}
