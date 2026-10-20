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
  /**
   * Karşı dildeki karşılıklar (DOG-73); eşleşme için synonyms'e de ekli.
   * Ayrı tutulmasının sebebi uyarlama: CV başka dildeyse madde, ilan terimi
   * yerine bu karşılıkla hizalanıyor ve CV kendi dilinde kalıyor (DOG-104).
   * Bu alandan önce çıkarılmış ilanlarda yok.
   */
  equivalents: z.array(z.string()).optional(),
})

export const RequirementSchema = z.object({
  /** Gereksinimin ilandaki hâli — kullanıcıya bu gösterilir. */
  text: z.string(),
  /**
   * condition (DOG-115): evet/hayır şartı (ikamet, seyahat, askerlik, ehliyet,
   * vatandaşlık ya da çalışma izni, çalışma düzeni). Skora girmiyor; ekranda
   * "Şartlar" kutusunda, CV'de görünüyor ya da kontrol et olarak.
   */
  type: z.enum(["skill", "experience", "education", "soft", "condition"]),
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
  /**
   * Son başvuru tarihi, `YYYY-MM-DD` (DOG-120). Kodda çözümleniyor
   * (extract/deadline.ts); ilanda açıkça yazmıyorsa null. Bu alandan önce
   * çıkarılmış ilanlarda yok.
   */
  deadline: z.string().nullable().optional(),
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

export const JobPostingDraftSchema = JobPostingSchema.omit({ requirements: true, deadline: true }).extend({
  requirements: z.array(RequirementDraftSchema),
  /** İlandaki son başvuru ifadesi, olduğu gibi (DOG-120); yoksa null. Tarihe kod çeviriyor. */
  deadlineText: z.string().nullable(),
})

/**
 * Okuma hoşgörülü: alanı atlayan yanıt (eski önbellek, sahte model) son
 * başvuru tarihi yok sayılıyor. Modele giden şema yine katı.
 */
export const JobPostingDraftParseSchema = JobPostingDraftSchema.extend({
  deadlineText: z.string().nullable().default(null),
})

export type Concept = z.infer<typeof ConceptSchema>
export type Requirement = z.infer<typeof RequirementSchema>
export type RequirementDraft = z.infer<typeof RequirementDraftSchema>
export type JobPostingData = z.infer<typeof JobPostingSchema>
export type JobPostingDraft = z.infer<typeof JobPostingDraftSchema>

export const jobPostingJsonSchema = toJsonSchema(JobPostingSchema)
export const jobPostingDraftJsonSchema = toJsonSchema(JobPostingDraftSchema)

/** Kavramların karşı dildeki karşılıkları (DOG-73, extract/equivalents.ts). */
export const ConceptEquivalentsSchema = z.object({
  items: z.array(
    z.object({
      term: z.string(),
      equivalents: z.array(z.string()),
    }),
  ),
})
export const conceptEquivalentsJsonSchema = toJsonSchema(ConceptEquivalentsSchema)
