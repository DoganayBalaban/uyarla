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
  summaryBlock: z.string(),
  experienceBlock: z.string(),
  educationBlock: z.string(),
  skillsBlock: z.string(),
})

/** Aşama 2 şemaları: her blok için ayrı ve kısa çağrı. */
export const ExperienceListSchema = z.object({ experience: z.array(ExperienceSchema) })
export const EducationListSchema = z.object({ education: z.array(EducationSchema) })
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

export const resumeProfileJsonSchema = toJsonSchema(ResumeProfileSchema)
export const resumeSegmentsJsonSchema = toJsonSchema(ResumeSegmentsSchema)
export const experienceListJsonSchema = toJsonSchema(ExperienceListSchema)
export const educationListJsonSchema = toJsonSchema(EducationListSchema)
export const skillsJsonSchema = toJsonSchema(SkillsSchema)
