import { PermanentError } from "@uyarla/core"
import { analysisFormSchema } from "@/features/analysis/schema"
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
