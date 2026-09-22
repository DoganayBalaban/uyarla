import type { ExtractResult, LlmProvider } from "../llm/types.js"
import {
  JobPostingDraftSchema,
  JobPostingSchema,
  RequirementKeywordsSchema,
  jobPostingDraftJsonSchema,
  requirementKeywordsJsonSchema,
} from "../schemas/job.js"
import type { JobPostingData } from "../schemas/job.js"
import { JOB_PROMPT, KEYWORDS_PROMPT } from "./prompts.js"

/**
 * İlan çıkarımı iki çağrı (K-11).
 *
 * Birincisi gereksinim listesini çıkarır, ikincisi o listeye anahtar kelime
 * üretir. Tek çağrıda birleştirmek — yani gereksinim nesnesinin içine bir
 * dizi daha koymak — küçük modelde dış listeyi erken kapattırıyordu: altı
 * gereksinimin dördü dönüyor, düşenler her seferinde "tercihen"
 * bölümündekiler oluyordu.
 *
 * Çıkan listenin kalitesi tüm skorun kalitesini belirliyor: "3 yıl React
 * deneyimi" için ["react", "react.js", "reactjs"] üretilirse eşleşme tutar,
 * yalnızca gereksinim cümlesinin kopyası üretilirse hiçbir CV'de bulunmaz.
 */
export async function extractJobPosting(
  llm: LlmProvider,
  rawText: string,
): Promise<ExtractResult<JobPostingData>> {
  const draft = await llm.extract({
    prompt: JOB_PROMPT,
    schemaName: "job_posting_draft",
    schema: jobPostingDraftJsonSchema,
    input: rawText,
  })
  const posting = JobPostingDraftSchema.parse(draft.data)

  if (posting.requirements.length === 0) {
    return { data: JobPostingSchema.parse({ ...posting, requirements: [] }), tokens: draft.tokens }
  }

  const keywords = await llm.extract({
    prompt: KEYWORDS_PROMPT,
    schemaName: "requirement_keywords",
    schema: requirementKeywordsJsonSchema,
    input: posting.requirements.map((r, i) => `${i + 1}. ${r.text}`).join("\n"),
  })
  const { keywords: listeler } = RequirementKeywordsSchema.parse(keywords.data)

  // Hizalama garanti değil. Eksik kalan gereksinim anahtar kelimesiz kalır;
  // skorlamada anlamsal eşleşmeye düşer, sessizce yanlış eşleşmez.
  const data = JobPostingSchema.parse({
    ...posting,
    requirements: posting.requirements.map((req, i) => ({
      ...req,
      keywords: listeler[i] ?? [],
    })),
  })

  return { data, tokens: draft.tokens + keywords.tokens }
}
