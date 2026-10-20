import { z } from "zod"
import { MAX_REPORT_POSTINGS } from "@uyarla/core/linkedin/reportRecord"

/** CV kütüphanesi şemaları; arayüz ve `/api/resumes` uçları ortak kullanıyor. */

export const LIBRARY_MAX = 5
export const LABEL_MAX_LENGTH = 60

/** Boş etiket "dosya adını göster" demek; veritabanına null yazılıyor. */
export const labelSchema = z
  .string({ error: "Geçersiz CV adı." })
  .trim()
  .max(LABEL_MAX_LENGTH, `CV adı en fazla ${LABEL_MAX_LENGTH} karakter olabilir.`)
  .transform((value) => value || null)

export const resumePatchSchema = z
  .object({
    label: labelSchema.nullable().optional(),
    // Yalnızca true: varsayılan, başka bir CV varsayılan yapılınca el değiştiriyor.
    isDefault: z.literal(true, { error: "Geçersiz istek." }).optional(),
  })
  .refine((body) => body.label !== undefined || body.isDefault !== undefined, {
    error: "Güncellenecek bir şey yok.",
  })

export type ResumePatch = z.output<typeof resumePatchSchema>

/** `GET /api/resumes` satırı. */
export interface LibraryResume {
  id: string
  label: string | null
  fileName: string | null
  createdAt: string
  isDefault: boolean
}

/** `POST /api/resumes/[id]`: LinkedIn profil raporu iste (DOG-69). */
export const linkedinReportRequestSchema = z.object({
  type: z.literal("linkedin-report"),
  analysisIds: z
    .array(z.string().min(1), { error: "İlan seçer misin?" })
    .min(1, "En az bir ilan seç.")
    .max(MAX_REPORT_POSTINGS, `En fazla ${MAX_REPORT_POSTINGS} ilan seçebilirsin.`)
    .refine((ids) => new Set(ids).size === ids.length, "Aynı ilan iki kez seçilmiş."),
})
