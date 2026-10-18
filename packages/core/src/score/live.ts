import type { EmbeddingProvider } from "../llm/types.js"
import { resumeLanguage } from "../normalize/language.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { collectEvidence } from "./evidence.js"
import { conceptTexts, score, type ScoreResult } from "./score.js"

/**
 * Kayıtlı CV profilini bir ilana karşı yeniden puanlar: kanıtlar ve kavramlar
 * tek gömme çağrısında, LLM yok. Kullanıcı ilanın şartını düzelttiğinde
 * (DOG-90) analiz route'u bunu düzeltilmiş ilanla çağırıyor; gömmeler
 * worker'la ortak önbellekten geldiği için değişmeyen kavramlar analizdeki
 * vektörünü koruyor (DOG-57).
 */
export async function scoreProfile(
  input: { profile: ResumeProfile; posting: JobPostingData; now?: Date },
  embedding: EmbeddingProvider,
): Promise<ScoreResult> {
  const evidence = collectEvidence(input.profile)
  const evidenceTexts = evidence.map((e) => e.text)
  const concepts = conceptTexts(input.posting, resumeLanguage(input.profile))
  // Sıra analiz hattıyla aynı: kanıtlar önce, kavramlar sonra.
  const vectors = await embedding.embed([...evidenceTexts, ...concepts])
  return score({
    profile: input.profile,
    posting: input.posting,
    evidence,
    evidenceVectors: vectors.slice(0, evidenceTexts.length),
    conceptVectors: vectors.slice(evidenceTexts.length),
    now: input.now,
  })
}
