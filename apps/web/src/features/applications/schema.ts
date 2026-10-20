import { z } from "zod"
import { ANSWER_MAX_LENGTH, ANSWER_MIN_LENGTH } from "@uyarla/core/interview/practiceRecord"
import { LIMIT_RANGE, QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH } from "@uyarla/core/cover/formAnswerRecord"
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

/** `POST /api/applications/[id]`: mülakat hazırlık paketi iste (DOG-118). */
export const interviewPrepRequestSchema = z.object({ type: z.literal("interview-prep") })

/** `POST /api/applications/[id]`: yazılı pratik cevabına geri bildirim iste (DOG-97). */
export const practiceRequestSchema = z.object({
  type: z.literal("practice"),
  questionIndex: z.number({ error: "Geçersiz soru." }).int().min(0, "Geçersiz soru."),
  answer: z
    .string({ error: "Cevap gerekli." })
    .trim()
    .min(ANSWER_MIN_LENGTH, `Cevabın en az ${ANSWER_MIN_LENGTH} karakter olmalı.`)
    .max(ANSWER_MAX_LENGTH, `Cevabın en fazla ${ANSWER_MAX_LENGTH} karakter olabilir.`),
})

export type PracticeRequest = z.infer<typeof practiceRequestSchema>

/** `POST /api/applications/[id]`: başvuru formu sorusuna yanıt iste (DOG-123). */
export const formAnswerRequestSchema = z
  .object({
    type: z.literal("form-answer"),
    question: z
      .string({ error: "Soruyu yazar mısın?" })
      .trim()
      .min(QUESTION_MIN_LENGTH, "Soruyu yazar mısın?")
      .max(QUESTION_MAX_LENGTH, `Soru en fazla ${QUESTION_MAX_LENGTH} karakter olabilir.`),
    limit: z
      .object({ unit: z.enum(["chars", "words"]), max: z.number({ error: "Geçersiz sınır." }).int("Geçersiz sınır.") })
      .nullable()
      .optional(),
  })
  .refine((b) => !b.limit || (b.limit.max >= LIMIT_RANGE[b.limit.unit].min && b.limit.max <= LIMIT_RANGE[b.limit.unit].max), {
    error: `Sınır ${LIMIT_RANGE.chars.min}–${LIMIT_RANGE.chars.max} karakter ya da ${LIMIT_RANGE.words.min}–${LIMIT_RANGE.words.max} kelime olabilir.`,
  })

export type FormAnswerRequest = z.infer<typeof formAnswerRequestSchema>
