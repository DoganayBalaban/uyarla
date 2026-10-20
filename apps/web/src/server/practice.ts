import type { InterviewPrepRecord } from "@uyarla/core/interview/prep"
import { MAX_PRACTICE_PER_QUESTION, type PracticeEntry } from "@uyarla/core/interview/practiceRecord"

export type PracticeError = "no_prep" | "no_question" | "too_many" | "already_running"

export const PRACTICE_ERROR_MESSAGE: Record<PracticeError, string> = {
  no_prep: "Önce hazırlık paketini oluştur.",
  no_question: "Bu soru pakette yok; sayfayı yenile.",
  too_many: `Bir soruya en fazla ${MAX_PRACTICE_PER_QUESTION} kez geri bildirim alabiliyorsun.`,
  already_running: "Bu sorudaki cevabın hâlâ değerlendiriliyor.",
}

/**
 * Yeni pratik cevabını hazırlık kaydına ekler (DOG-97). Saf: kilit ve kayıt
 * route'ta. Paket yeniden yazılırken de soru listesi önceki paketten.
 */
export function addPractice(
  current: InterviewPrepRecord | null,
  input: { questionIndex: number; answer: string },
  id: string,
  now: Date,
): { record: InterviewPrepRecord; entry: PracticeEntry } | { error: PracticeError } {
  if (!current?.prep) return { error: "no_prep" }
  if (!current.prep.questions[input.questionIndex]) return { error: "no_question" }
  const list = current.practice ?? []
  const same = list.filter((p) => p.questionIndex === input.questionIndex && p.status !== "failed")
  if (same.some((p) => p.status === "running")) return { error: "already_running" }
  if (same.length >= MAX_PRACTICE_PER_QUESTION) return { error: "too_many" }
  const entry: PracticeEntry = { id, ...input, status: "running", createdAt: now.toISOString() }
  return { record: { ...current, practice: [...list, entry] }, entry }
}
