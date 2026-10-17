import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { ConceptEquivalentsSchema, conceptEquivalentsJsonSchema } from "../schemas/job.js"
import { isProperNoun } from "../score/score.js"
import { EQUIVALENTS_PROMPT } from "./prompts.js"

/** Bir karşılık bir kavram adı kadar kısa olmalı; uzun cümleler eşleşmeyi bozar. */
const MAX_EQUIVALENT_LENGTH = 45

/**
 * İlan kavramlarına karşı dildeki karşılıklarını eş anlamlı olarak ekler
 * (DOG-73).
 *
 * Üretim duman testinde İngilizce bir test mühendisi CV'si, Türkçe ilanda
 * "test otomasyonu", "API testleri", "hata takibi" kavramlarını karşılamadı:
 * kelime eşleşmesi dil sınırını geçemiyor, gömme benzerliği de eşiğin altında
 * kalıyor. Karşılıklar eş anlamlı olunca eşleşme kelime düzeyinde, yani kesin.
 *
 * Özel adlar (Selenium, SQL, Postman) gönderilmiyor: her dilde aynılar.
 * Çevrilecek kavram yoksa çağrı yapılmıyor. Çağrı düşerse ilan karşılıksız
 * dönüyor: bu bir iyileştirme, analizi durdurmamalı.
 */
export async function addLanguageEquivalents(
  llm: LlmProvider,
  posting: JobPostingData,
): Promise<ExtractResult<JobPostingData>> {
  const terms = [
    ...new Set(posting.requirements.flatMap((r) => r.concepts.filter(needsEquivalent).map((c) => c.term))),
  ]
  if (terms.length === 0) return { data: posting, tokens: 0 }

  let found: Map<string, string[]>
  let tokens: number
  try {
    const result = await llm.extract({
      prompt: EQUIVALENTS_PROMPT,
      schemaName: "concept_equivalents",
      schema: conceptEquivalentsJsonSchema,
      input: JSON.stringify({ language: posting.language, terms }),
    })
    const parsed = ConceptEquivalentsSchema.parse(result.data)
    tokens = result.tokens
    found = new Map(parsed.items.map((item) => [key(item.term), item.equivalents]))
  } catch (error) {
    console.warn("[ilan] karşılıklar alınamadı, ilan karşılıksız devam ediyor", error)
    return { data: posting, tokens: 0 }
  }

  const asked = new Set(terms.map(key))
  const data: JobPostingData = {
    ...posting,
    requirements: posting.requirements.map((r) => ({
      ...r,
      concepts: r.concepts.map((c) => {
        if (!asked.has(key(c.term))) return c
        const existing = new Set([c.term, ...c.synonyms].map(key))
        const extra = (found.get(key(c.term)) ?? [])
          .map((e) => e.trim())
          .filter((e) => e.length > 0 && e.length <= MAX_EQUIVALENT_LENGTH && !existing.has(key(e)))
        return extra.length ? { ...c, synonyms: [...new Set([...c.synonyms, ...extra])], equivalents: extra } : c
      }),
    })),
  }
  return { data, tokens }
}

const key = (text: string) => text.trim().toLocaleLowerCase("tr")

/**
 * Karşılık aranacak kavram: özel ad değilse ya da içinde sıradan (küçük harfle
 * başlayan) bir kelime varsa. "API testleri" kısaltma yüzünden özel ad
 * sayılıyor (K-38) ama "testleri" çevrilmeli; "Selenium WebDriver" çevrilmez.
 */
function needsEquivalent(concept: { term: string; synonyms: string[] }): boolean {
  return !isProperNoun(concept) || /(^|\s)\p{Ll}/u.test(concept.term)
}
