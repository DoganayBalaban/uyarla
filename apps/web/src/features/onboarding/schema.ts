import { z } from "zod"

/**
 * Profil ve onboarding şemaları. Onboarding ekranı, hesabım sayfası ve
 * `PATCH /api/profile` aynı kurallarla doğruluyor.
 */

export const GOALS = ["career_change", "first_job", "promotion", "exploring"] as const
export type Goal = (typeof GOALS)[number]

export const NAME_MAX_LENGTH = 60
export const TARGET_ROLE_MAX_LENGTH = 80

export const nameSchema = z
  .string({ error: "Adını yazar mısın?" })
  .trim()
  .min(1, "Adını yazar mısın?")
  .max(NAME_MAX_LENGTH, `Ad en fazla ${NAME_MAX_LENGTH} karakter olabilir.`)

/** Boş metin "hedef rol yok" demek; veritabanına null yazılıyor. */
const targetRoleSchema = z
  .string({ error: "Geçersiz hedef rol." })
  .trim()
  .max(TARGET_ROLE_MAX_LENGTH, `Hedef rol en fazla ${TARGET_ROLE_MAX_LENGTH} karakter olabilir.`)
  .transform((value) => value || null)

export const profilePatchSchema = z
  .object({
    name: nameSchema.optional(),
    goal: z.enum(GOALS, { error: "Geçersiz amaç." }).nullable().optional(),
    targetRole: targetRoleSchema.nullable().optional(),
    /** Onboarding bitti ya da atlandı. */
    completeOnboarding: z.literal(true).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: "Güncellenecek bir şey yok.",
  })

export type ProfilePatch = z.output<typeof profilePatchSchema>
