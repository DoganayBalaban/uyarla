import { z } from "zod"
import { NOTE_MAX_LENGTH, STAGES } from "@/features/applications/board"

/**
 * Pano kartının şemaları. Not formu (react-hook-form) ve
 * `PATCH /api/applications/[id]` aynı kurallarla doğruluyor.
 */

export const noteSchema = z
  .string({ error: "Geçersiz not." })
  .trim()
  .max(NOTE_MAX_LENGTH, `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.`)

export const noteFormSchema = z.object({ note: noteSchema })

export type NoteFormValues = z.input<typeof noteFormSchema>

/**
 * PATCH gövdesi: aşama ve/veya not. `note: null` ya da boş metin notu
 * siliyor. En az biri gelmeli.
 */
export const applicationPatchSchema = z
  .object({
    stage: z.enum(STAGES, { error: "Geçersiz aşama." }).optional(),
    note: noteSchema.nullable().optional(),
  })
  .refine((body) => body.stage !== undefined || body.note !== undefined, {
    error: "Güncellenecek bir şey yok.",
  })
