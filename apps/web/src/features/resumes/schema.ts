import { z } from "zod"

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
  /** Bu CV'yle yapılmış analizler, en yeni önce (DOG-137); en fazla LIBRARY_APPLICATIONS_SHOWN. */
  applications?: LibraryApplication[]
  /** Toplam sayı; listede gösterilenden fazla olabilir. */
  applicationCount?: number
}

export interface LibraryApplication {
  analysisId: string
  position: string
  company: string | null
  stage: string
}

export const LIBRARY_APPLICATIONS_SHOWN = 3
