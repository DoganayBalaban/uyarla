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

export type Requirement = z.infer<typeof RequirementSchema>
export type JobPostingData = z.infer<typeof JobPostingSchema>

export const jobPostingJsonSchema = toJsonSchema(JobPostingSchema)
