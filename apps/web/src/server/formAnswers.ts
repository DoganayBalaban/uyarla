import { MAX_FORM_ANSWERS, readFormAnswers, type FormAnswerRecord } from "@uyarla/core/cover/formAnswerRecord"

export type FormAnswerError = "too_many" | "already_running"

export const FORM_ANSWER_ERROR_MESSAGE: Record<FormAnswerError, string> = {
  too_many: `Bu başvuru için en fazla ${MAX_FORM_ANSWERS} form yanıtı yazabiliyoruz.`,
  already_running: "Önceki yanıt hâlâ yazılıyor; bitince yenisini isteyebilirsin.",
}

/**
 * Yeni form yanıtı isteğini diziye ekler (DOG-123). Saf: kilit ve kayıt
 * route'ta. Aynı anda tek yanıt yazılıyor; başarısızlar sayılmıyor.
 */
export function addFormAnswer(
  current: unknown,
  input: { question: string; limit: FormAnswerRecord["limit"] },
  id: string,
  now: Date,
): { list: FormAnswerRecord[]; record: FormAnswerRecord } | { error: FormAnswerError } {
  const list = readFormAnswers(current)
  const live = list.filter((a) => a.status !== "failed")
  if (live.some((a) => a.status === "running")) return { error: "already_running" }
  if (live.length >= MAX_FORM_ANSWERS) return { error: "too_many" }
  const record: FormAnswerRecord = { id, question: input.question, limit: input.limit, status: "running", createdAt: now.toISOString() }
  // Ham diziye ekleniyor: bu sürümün tanımadığı kayıtlar silinmesin.
  return { list: [...(Array.isArray(current) ? (current as FormAnswerRecord[]) : []), record], record }
}
