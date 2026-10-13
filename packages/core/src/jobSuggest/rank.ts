import type { EmbeddingProvider } from "../llm/types.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { cosineSimilarity } from "../llm/embedding.js"
import type { ExternalJob } from "./sources.js"

/** CV'nin öneri için kısa özü: özet, unvanlar, beceriler. Madde metni gürültü katıyor. */
export function profileText(profile: ResumeProfile): string {
  return [profile.summary, profile.experience.map((e) => e.title).join(", "), profile.skills.join(", ")]
    .filter((part) => part && part.trim())
    .join("\n")
}

export interface RankedJob {
  job: ExternalJob
  similarity: number
}

/**
 * İlanları CV'ye benzerliğe göre sıralar (DOG-67). LLM yok, tek toplu gömme
 * çağrısı; önbellekli sağlayıcıyla aynı ilan ikinci kez gömülmüyor. Bu kaba
 * bir ön sıralama: ilanın yalnızca başlığı ve kısa özeti var, asıl skor
 * "analiz et" adımında tam metinle hesaplanıyor.
 */
export async function rankJobs(
  embedding: EmbeddingProvider,
  profile: ResumeProfile,
  jobs: ExternalJob[],
): Promise<RankedJob[]> {
  // İki kaynak aynı ilanı döndürebiliyor; başlık + şirket ile tekilleştiriliyor.
  const seen = new Set<string>()
  const unique = jobs.filter((j) => {
    const key = `${j.title} ${j.company ?? ""}`.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length === 0) return []

  const [cv, ...jobVectors] = await embedding.embed([
    profileText(profile),
    ...unique.map((j) => `${j.title}\n${j.snippet}`),
  ])
  return unique
    .map((job, i) => ({ job, similarity: cosineSimilarity(cv!, jobVectors[i]!) }))
    .sort((a, b) => b.similarity - a.similarity)
}
