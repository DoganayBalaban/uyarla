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

/** Mülakat günü (DOG-98): tarih kutusunun "YYYY-AA-GG" değeri; null siliyor. */
export const interviewDateSchema = z
  .string({ error: "Geçersiz tarih." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Geçersiz tarih.")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Geçersiz tarih.")

/**
 * PATCH gövdesi: aşama, not ve/veya mülakat günü. `note: null` ya da boş
 * metin notu, `interviewAt: null` tarihi siliyor. En az biri gelmeli.
 */
export const applicationPatchSchema = z
  .object({
    stage: z.enum(STAGES, { error: "Geçersiz aşama." }).optional(),
    note: noteSchema.nullable().optional(),
    interviewAt: interviewDateSchema.nullable().optional(),
  })
  .refine((body) => body.stage !== undefined || body.note !== undefined || body.interviewAt !== undefined, {
    error: "Güncellenecek bir şey yok.",
  })

/** `POST /api/applications/[id]` gövdesi: takip mesajı ya da teşekkür notu taslağı iste (DOG-117). */
export const followUpRequestSchema = z.object({
  kind: z.enum(["followup", "thanks"], { error: "Geçersiz tür." }),
  channel: z.enum(["email", "linkedin"], { error: "Geçersiz kanal." }),
})
