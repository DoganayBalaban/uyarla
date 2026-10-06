import { z } from "zod"

/** `POST /api/adapt` gövdesi. */
export const adaptRequestSchema = z.object({
  analysisId: z.string({ error: "Analiz kimliği gerekli." }).min(1, "Analiz kimliği gerekli."),
})
