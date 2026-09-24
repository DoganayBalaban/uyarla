import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { JobPostingDraftSchema, JobPostingSchema, jobPostingDraftJsonSchema } from "../schemas/job.js"
import type { JobPostingData } from "../schemas/job.js"
import { splitIntoConcepts } from "./concepts.js"
import { JOB_PROMPT } from "./prompts.js"

/**
 * İlan çıkarımı TEK çağrı.
 *
 * Model yalnızca gerçekten yorum gerektiren işi yapıyor: ilan metninden
 * gereksinimleri ayırmak, türünü ve önemini belirlemek. Gereksinimin
 * kavramlarına bölünmesi kodda yapılıyor (K-23).
 *
 * Önceki tasarım bu işi ikinci bir LLM çağrısına veriyordu ve üç ayrı biçimde
 * kırıldı: kavramları eksik çıkarma, eş anlamlıları boş bırakma, listeyi
 * erken kapatma. Ayrıca iki çağrı arasında hizalama sorunu vardı ve
 * doğrulanması gerekiyordu (K-18) — o sorun da tümüyle ortadan kalktı.
 *
 * Yan kazanç: ilan çıkarımı 21 saniyeden tek çağrıya indi.
 */
export async function extractJobPosting(
  llm: LlmProvider,
  rawText: string,
): Promise<ExtractResult<JobPostingData>> {
  const { data, tokens } = await llm.extract({
    prompt: JOB_PROMPT,
    schemaName: "job_posting_draft",
    schema: jobPostingDraftJsonSchema,
    input: rawText,
  })
  const draft = JobPostingDraftSchema.parse(data)

  const posting = JobPostingSchema.parse({
    ...draft,
    requirements: draft.requirements.map((req) => ({
      ...req,
      concepts: splitIntoConcepts(req.text),
    })),
  })

  return { data: posting, tokens }
}
