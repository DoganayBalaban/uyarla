import { z } from "zod"
import { VerificationSchema } from "../schemas/adaptation.js"

/**
 * Başvuru formu yanıtı kaydı (DOG-123). Ayrı modül: tarayıcı da okuyor;
 * yanıtı yazan `formAnswer.ts` doğrulama kodunu çekiyor ve istemciye
 * gitmemeli.
 */
export const QUESTION_MIN_LENGTH = 5
export const QUESTION_MAX_LENGTH = 1000
/** Bir başvuruda en çok bu kadar form yanıtı. */
export const MAX_FORM_ANSWERS = 10

export const FormAnswerLimitSchema = z.object({
  unit: z.enum(["chars", "words"]),
  max: z.number().int().positive(),
})
export type FormAnswerLimit = z.infer<typeof FormAnswerLimitSchema>

/** Sınırın kabul edilen aralığı: daha kısası anlamlı bir yanıt taşımaz. */
export const LIMIT_RANGE = { chars: { min: 50, max: 5000 }, words: { min: 10, max: 1000 } } as const

/** `Analysis.formAnswers` dizisinin bir öğesi. */
export const FormAnswerRecordSchema = z.object({
  id: z.string(),
  question: z.string(),
  limit: FormAnswerLimitSchema.nullable(),
  status: z.enum(["running", "done", "failed"]),
  text: z.string().optional(),
  verification: VerificationSchema.optional(),
  /** Kısaltmaya rağmen sınırı aşıyor; arayüz sayacı kırmızı gösteriyor. */
  overLimit: z.boolean().optional(),
  createdAt: z.string(),
})
export type FormAnswerRecord = z.infer<typeof FormAnswerRecordSchema>

/** Kayıtlar tek tek okunuyor; tanınmayan kayıt yalnızca kendisi atlanıyor (bkz. readFollowUps). */
export function readFormAnswers(value: unknown): FormAnswerRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = FormAnswerRecordSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Metnin sınırdaki uzunluğu: karakter ya da kelime. */
export function measure(text: string, unit: FormAnswerLimit["unit"]): number {
  return unit === "chars" ? text.length : countWords(text)
}
