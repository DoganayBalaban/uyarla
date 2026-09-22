import { z } from "zod"
import { toJsonSchema } from "./toJsonSchema.js"

export const RequirementSchema = z.object({
  /** Gereksinimin ilandaki hâli — kullanıcıya bu gösterilir. */
  text: z.string(),
  type: z.enum(["skill", "experience", "education", "soft"]),
  importance: z.enum(["must", "nice"]),
  /** Eşleştirme için aranacak biçimler; normalleştirme Görev 8'de. */
  keywords: z.array(z.string()),
})

export const JobPostingSchema = z.object({
  position: z.string(),
  company: z.string().nullable(),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead"]).nullable(),
  language: z.enum(["tr", "en"]),
  requirements: z.array(RequirementSchema),
})

/**
 * Birinci çağrının şeması: keywords YOK.
 *
 * Gereksinim nesnesinin içine bir dizi daha koymak (keywords) küçük modelde
 * dış listeyi erken kapattırıyor — altı gereksinimin yalnızca dördü
 * dönüyordu ve düşenler her seferinde "tercihen" bölümündekilerdi. Ölçümle
 * doğrulandı: keywords çıkarıldığında aynı prompt 6/6 üretiyor (K-11).
 */
export const RequirementDraftSchema = RequirementSchema.omit({ keywords: true })

export const JobPostingDraftSchema = JobPostingSchema.omit({ requirements: true }).extend({
  requirements: z.array(RequirementDraftSchema),
})

/**
 * İkinci çağrının şeması: gereksinim sırasıyla hizalı anahtar kelime listeleri.
 * Düz dizi-içinde-dizi biçimi, nesne sarmalayan biçime göre hem daha az token
 * harcıyor hem Türkçe terimleri daha iyi koruyor (ölçüldü).
 */
export const RequirementKeywordsSchema = z.object({
  keywords: z.array(z.array(z.string())),
})

export type Requirement = z.infer<typeof RequirementSchema>
export type RequirementDraft = z.infer<typeof RequirementDraftSchema>
export type JobPostingData = z.infer<typeof JobPostingSchema>
export type JobPostingDraft = z.infer<typeof JobPostingDraftSchema>

export const jobPostingJsonSchema = toJsonSchema(JobPostingSchema)
export const jobPostingDraftJsonSchema = toJsonSchema(JobPostingDraftSchema)
export const requirementKeywordsJsonSchema = toJsonSchema(RequirementKeywordsSchema)
