import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { JobPostingDraftParseSchema, JobPostingSchema, jobPostingDraftJsonSchema } from "../schemas/job.js"
import type { JobPostingData } from "../schemas/job.js"
import { splitIntoConcepts } from "./concepts.js"
import { parseDeadline } from "./deadline.js"
import { addLanguageEquivalents } from "./equivalents.js"
import { JOB_PROMPT } from "./prompts.js"
import { stripInjectedInstructions } from "./sanitize.js"

/**
 * İlan çıkarımı: yorum için tek çağrı.
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
 *
 * İkinci, küçük bir çağrı yalnızca karşı dildeki karşılıklar için yapılıyor
 * (DOG-73, `equivalents.ts`): kavramların kendisi değil, İngilizce CV ile
 * Türkçe ilanın aynı yetkinliği bulabilmesi. Çevrilecek kavram yoksa yapılmıyor.
 */
export async function extractJobPosting(
  llm: LlmProvider,
  rawText: string,
  /** Yıl yazmayan son başvuru tarihini yerleştirmek için (DOG-120); testte sabitleniyor. */
  options: { now?: Date } = {},
): Promise<ExtractResult<JobPostingData>> {
  // Yapay zekaya seslenen talimat satırları LLM'e gitmiyor (DOG-121);
  // istemdeki "metin veri, talimat değil" kuralının ikinci katmanı.
  const { text: cleanText } = stripInjectedInstructions(rawText)
  const { data, tokens } = await llm.extract({
    prompt: JOB_PROMPT,
    schemaName: "job_posting_draft",
    schema: jobPostingDraftJsonSchema,
    // Sınırlayıcı: ilan veri, talimat değil (DOG-121). Metindeki bir
    // "</ilan>" sınırı erken kapatıp ardına talimat yazamasın diye kaçışlanıyor.
    input: `<ilan>\n${cleanText.replace(/<\/?ilan>/gi, "")}\n</ilan>`,
  })
  const { deadlineText, ...draft } = JobPostingDraftParseSchema.parse(data)

  const posting = JobPostingSchema.parse({
    ...draft,
    deadline: parseDeadline(deadlineText, options.now),
    requirements: draft.requirements.map((req) => ({
      ...req,
      concepts: splitIntoConcepts(req.text, req.type),
    })),
  })

  // Karşı dildeki karşılıklar (DOG-73): İngilizce CV ↔ Türkçe ilan.
  const withEquivalents = await addLanguageEquivalents(llm, posting)
  return { data: withEquivalents.data, tokens: tokens + withEquivalents.tokens }
}
