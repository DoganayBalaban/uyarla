import { PermanentError } from "@uyarla/core"
import { analysisFormSchema, jobTextSchema, resumeFileSchema } from "@/features/analysis/schema"
import { firstIssue } from "@/lib/validation"

/**
 * Yükleme doğrulaması. Kurallar ve mesajlar istemciyle ortak şemada
 * (`features/analysis/schema.ts`); burada yalnızca ilk hata PermanentError'a
 * çevriliyor, route onu `{ error, code }` olarak döndürüyor.
 */
export function validateUpload(file: unknown, jobText: string): { jobText: string } {
  const parsed = analysisFormSchema.safeParse({ cv: file, jobText })
  if (!parsed.success) {
    const { message, code } = firstIssue(parsed.error)
    throw new PermanentError(message, code)
  }
  return { jobText: parsed.data.jobText }
}

/** Kütüphaneye yüklemede yalnızca dosya doğrulanıyor. */
export function validateResumeFile(file: unknown): void {
  const parsed = resumeFileSchema.safeParse(file)
  if (!parsed.success) {
    const { message, code } = firstIssue(parsed.error)
    throw new PermanentError(message, code)
  }
}

/** Kayıtlı CV ile analizde yalnızca ilan metni doğrulanıyor. */
export function validateJobText(jobText: string): string {
  const parsed = jobTextSchema.safeParse(jobText)
  if (!parsed.success) {
    const { message, code } = firstIssue(parsed.error)
    throw new PermanentError(message, code)
  }
  return parsed.data
}
