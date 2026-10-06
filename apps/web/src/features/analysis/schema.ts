import { z } from "zod"

/**
 * Analiz formunun şemaları. İstemci (react-hook-form) ve sunucu
 * (`api/analyze`, `api/job-url`) aynı kurallarla doğruluyor.
 *
 * Bu dosya @uyarla/core'u içe aktarmıyor: istemci paketine PDF/LLM kodu
 * sızmasın. Sunucu tarafı hatayı `server/upload.ts`'te PermanentError'a
 * çeviriyor.
 *
 * Mesajlar doğrudan kullanıcıya gösteriliyor, bu yüzden marka rehberi §6
 * tonunda: suçlamayan dil, sonraki adımı gösteren cümle. Her hatanın kendi
 * kodu var (`params.code`); API yanıtında `code` olarak dönüyor.
 */

export const MAX_RESUME_BYTES = 10 * 1024 * 1024
export const MIN_JOB_TEXT_LENGTH = 50
export const RESUME_EXTENSIONS = ["pdf", "docx"] as const

/** Doğrulamanın ihtiyaç duyduğu kadarı; tarayıcının ve Node'un File'ı ikisi de uyuyor. */
export interface ResumeFileLike {
  name: string
  size: number
}

function isFileLike(value: unknown): value is ResumeFileLike {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.name === "string" && typeof v.size === "number"
}

function issue(message: string, code: string) {
  return { code: "custom" as const, message, params: { code } }
}

export const resumeFileSchema = z.unknown().superRefine((value, ctx) => {
  if (!isFileLike(value)) {
    ctx.addIssue(issue("CV'ni seçer misin? PDF ya da DOCX olabilir.", "missing_file"))
    return
  }
  const parts = value.name.toLowerCase().split(".")
  const extension = parts.length > 1 ? parts.pop() : undefined
  if (!extension || !(RESUME_EXTENSIONS as readonly string[]).includes(extension)) {
    ctx.addIssue(issue("Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.", "unsupported_format"))
    return
  }
  if (value.size === 0) {
    ctx.addIssue(issue("Dosyan boş görünüyor. Tekrar yüklemeyi dener misin?", "empty_file"))
    return
  }
  if (value.size > MAX_RESUME_BYTES) {
    ctx.addIssue(issue("Dosyan 10 MB'tan büyük. Daha küçük bir sürümünü yükler misin?", "file_too_large"))
  }
}) as z.ZodType<ResumeFileLike>

export const jobTextSchema = z.string().superRefine((value, ctx) => {
  if (value.trim().length < MIN_JOB_TEXT_LENGTH) {
    ctx.addIssue(issue("İlan metni çok kısa görünüyor. İlanın tamamını yapıştırır mısın?", "job_text_too_short"))
  }
})

export const analysisFormSchema = z.object({
  cv: resumeFileSchema,
  jobText: jobTextSchema,
  /** Yalnızca istemcide: "İlanı getir" alanı. Sunucuya gönderilmiyor. */
  postingUrl: z.string().optional(),
})

export type AnalysisFormValues = z.input<typeof analysisFormSchema>

/** `POST /api/job-url` gövdesi; analiz formundaki bağlantı alanı da bunu kullanıyor. */
export const jobUrlSchema = z.object({
  url: z.string({ error: "İlan bağlantısını yapıştır." }).trim().min(1, "İlan bağlantısını yapıştır."),
})
