import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { normalizeText } from "../normalize/turkish.js"
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
  const { items } = RequirementKeywordsSchema.parse(keywords.data)

  const data = JobPostingSchema.parse({
    ...posting,
    requirements: posting.requirements.map((req) => ({
      ...req,
      keywords: keywordsForRequirement(req.text, items),
    })),
  })

  return { data, tokens: draft.tokens + keywords.tokens }
}

/** Metin eşleşmesinin kapsama yoluyla kabul edilebilmesi için asgari uzunluk. */
const MIN_KAPSAMA_UZUNLUGU = 15

/**
 * Bir gereksinimin anahtar kelimelerini, modelin döndürdüğü metinle
 * doğrulayarak bulur.
 *
 * Sıraya güvenmek yetmiyor: model bileşik bir gereksinimi alt maddelerine
 * bölüp her birine anahtar kelime üretebiliyor. Sayı tesadüfen tuttuğunda
 * uzunluk kontrolü bunu yakalamıyor ve anahtar kelimeler bir gereksinim
 * kaymış hâlde yapışıyor (K-18).
 *
 * Eşleşme bulunamazsa boş dizi döner: yanlış gereksinime anahtar kelime
 * yapıştırmaktansa o gereksinimi anlamsal eşleşmeye bırakmak yeğdir.
 */
function keywordsForRequirement(
  requirementText: string,
  items: Array<{ text: string; keywords: string[] }>,
): string[] {
  const aranan = normalizeText(requirementText)

  for (const item of items) {
    if (normalizeText(item.text) === aranan) return item.keywords
  }

  // Model metni kısaltmış veya uzatmış olabilir; kapsama yoluyla eşleştir.
  // Kısa metinlerde kapsama yanlış eşleşme üretir, bu yüzden alt sınır var.
  for (const item of items) {
    const echo = normalizeText(item.text)
    const kisa = Math.min(echo.length, aranan.length)
    if (kisa < MIN_KAPSAMA_UZUNLUGU) continue
    if (echo.includes(aranan) || aranan.includes(echo)) return item.keywords
  }

  return []
}
