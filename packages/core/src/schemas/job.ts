import { z } from "zod"
import { toJsonSchema } from "./toJsonSchema.js"

/**
 * Bir gereksinimin içindeki tek bir kavram ve onun eş anlamlıları.
 *
 * Kavram ayrımı olmadan "eş anlamlı" ile "ayrı bileşen" ayırt edilemiyordu:
 * ["react","react.js","reactjs"] üçü de aynı şey (biri eşleşirse tam puan),
 * ["git","ci/cd","microservices","docker"] ise dört ayrı şey (biri eşleşirse
 * çeyrek puan). İkisi de düz dizi olduğu için dört şey isteyen bir gereksinim,
 * bir tanesini bilen adaya tam puan veriyordu (K-23).
 */
export const ConceptSchema = z.object({
  /** Kavramın kanonik adı; kullanıcıya eksik listesinde bu gösterilir. */
  term: z.string(),
  /** Yazım varyantları ve çeviriler; herhangi biri eşleşirse kavram karşılanır. */
  synonyms: z.array(z.string()),
})

export const RequirementSchema = z.object({
  /** Gereksinimin ilandaki hâli — kullanıcıya bu gösterilir. */
  text: z.string(),
  type: z.enum(["skill", "experience", "education", "soft"]),
  importance: z.enum(["must", "nice"]),
  /** Gereksinimin içerdiği kavramlar; güven bunların kaçının karşılandığıyla ölçülür. */
  concepts: z.array(ConceptSchema),
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
export const RequirementDraftSchema = RequirementSchema.omit({ concepts: true })

export const JobPostingDraftSchema = JobPostingSchema.omit({ requirements: true }).extend({
  requirements: z.array(RequirementDraftSchema),
})

export type Concept = z.infer<typeof ConceptSchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type RequirementDraft = z.infer<typeof RequirementDraftSchema>
export type JobPostingData = z.infer<typeof JobPostingSchema>
export type JobPostingDraft = z.infer<typeof JobPostingDraftSchema>

export const jobPostingJsonSchema = toJsonSchema(JobPostingSchema)
export const jobPostingDraftJsonSchema = toJsonSchema(JobPostingDraftSchema)
