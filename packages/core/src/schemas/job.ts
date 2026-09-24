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
 * İkinci çağrının şeması: her anahtar kelime listesi, ait olduğu gereksinimin
 * metnini de taşır.
 *
 * Önceki biçim yalnızca `keywords: string[][]` idi ve hizalamayı **sıraya
 * güvenerek** yapıyordu. Değerlendirme setinde sessizce kırıldı: bileşik bir
 * gereksinimde ("4+ years of production software engineering: APIs, services,
 * data infrastructure, testing, CI/CD, on-call") model iki nokta üst üsteden
 * sonraki listeyi ayrı gereksinimler sayıp her birine anahtar kelime üretti.
 * Sayı tesadüfen tuttuğu için uzunluk kontrolü devreye girmedi ve anahtar
 * kelimeler bir gereksinim kaymış hâlde yapıştı — bir AI mühendisi CV'si AI
 * mühendisi ilanına 5 puan aldı (K-18).
 *
 * Metin taşınması token maliyetini artırıyor ama hizalamayı **doğrulanabilir**
 * kılıyor: eşleşmeyen satırın anahtar kelimeleri boş bırakılır.
 */
export const RequirementKeywordsSchema = z.object({
  items: z.array(
    z.object({
      /** Gereksinimin metni; hizalama bununla doğrulanır. */
      text: z.string(),
      keywords: z.array(z.string()),
    }),
  ),
})

export type Requirement = z.infer<typeof RequirementSchema>
export type RequirementDraft = z.infer<typeof RequirementDraftSchema>
export type JobPostingData = z.infer<typeof JobPostingSchema>
export type JobPostingDraft = z.infer<typeof JobPostingDraftSchema>

export const jobPostingJsonSchema = toJsonSchema(JobPostingSchema)
export const jobPostingDraftJsonSchema = toJsonSchema(JobPostingDraftSchema)
export const requirementKeywordsJsonSchema = toJsonSchema(RequirementKeywordsSchema)
