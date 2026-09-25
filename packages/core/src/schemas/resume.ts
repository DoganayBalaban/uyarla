import { z } from "zod"
import { toJsonSchema } from "./toJsonSchema.js"

/**
 * sourceRef: bu maddenin ham CV metnindeki birebir karşılığı.
 * Sprint 2'deki uydurma kontrolünün temeli (spec §6.2) — sonradan eklemek
 * tüm çıkarımı yeniden çalıştırmak demek olurdu.
 */
export const BulletSchema = z.object({
  text: z.string(),
  sourceRef: z.string(),
})

export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(BulletSchema),
})

export const EducationSchema = z.object({
  school: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  endDate: z.string().nullable(),
})

export const ResumeProfileSchema = z.object({
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  certifications: z.array(z.string()),
})

/** Aşama 1: ham metni kaba bloklara böler (spec §6.3). */
export const ResumeSegmentsSchema = z.object({
  /**
   * İlk bölüm başlığından önceki satırlar: ad, unvan, iletişim.
   *
   * Sprint 1'de bu satırlar summaryBlock'a karışıyordu ve özet metni
   * iletişim bilgisiyle başlıyordu. Skor bunu kullanmadığı için fark
   * edilmemişti; indirilen belgede görünür oldu.
   */
  headerBlock: z.string(),
  summaryBlock: z.string(),
  experienceBlock: z.string(),
  educationBlock: z.string(),
  skillsBlock: z.string(),
})

/** Aşama 2 şemaları: her blok için ayrı ve kısa çağrı. */
export const ExperienceListSchema = z.object({ experience: z.array(ExperienceSchema) })
export const EducationListSchema = z.object({ education: z.array(EducationSchema) })
/**
 * Beceri bölümünün SATIR SATIR transkripsiyonu.
 *
 * Model "hangisi beceri" kararını vermiyor, yalnızca satırları kopyalıyor;
 * yorum kodda yapılıyor (flattenSkillLines). Sebebi ölçümle bulundu: beceri
 * bölümü birden çok alt başlık içerdiğinde ("Core Skills" + "Technical
 * Skills") model bunlardan yalnızca birini döndürüyor ve diğerini tümüyle
 * atıyordu — hangi prompt yazılırsa yazılsın. Satır transkripsiyonu istendiğinde
 * ise hiçbir satırı kaçırmıyor (K-19).
 */
export const SkillLinesSchema = z.object({
  lines: z.array(
    z.object({
      /** İki nokta üst üsteden önceki kısım; ya kategori ya beceri adı. */
      label: z.string(),
      /** Kısa terimlerin virgüllü listesiyse öğeler; cümleyse boş. */
      items: z.array(z.string()),
    }),
  ),
  languages: z.array(z.string()),
  certifications: z.array(z.string()),
})

/** Düzleştirilmiş hâl; hattın geri kalanı bunu görür. */
export const SkillsSchema = z.object({
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  certifications: z.array(z.string()),
})

export type Bullet = z.infer<typeof BulletSchema>
export type Experience = z.infer<typeof ExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>
export type ResumeSegments = z.infer<typeof ResumeSegmentsSchema>
export type SkillLines = z.infer<typeof SkillLinesSchema>

export const resumeProfileJsonSchema = toJsonSchema(ResumeProfileSchema)
export const resumeSegmentsJsonSchema = toJsonSchema(ResumeSegmentsSchema)
export const experienceListJsonSchema = toJsonSchema(ExperienceListSchema)
export const educationListJsonSchema = toJsonSchema(EducationListSchema)
export const skillLinesJsonSchema = toJsonSchema(SkillLinesSchema)
export const skillsJsonSchema = toJsonSchema(SkillsSchema)
