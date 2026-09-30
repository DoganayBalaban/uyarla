import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { collectEvidence } from "../score/evidence.js"
import { conceptTexts, score } from "../score/score.js"
import { applyAdaptation } from "./profile.js"

/**
 * Kabul edilen içerikten yeni skoru hesaplar (spec §10).
 *
 * Yeni LLM çağrısı yok — imzada `LlmProvider` bile geçmiyor. Çıkarım Sprint
 * 1'de yapıldı; burada değişen tek şey kanıt kümesi.
 *
 * Skorun yükselmesi garanti değil ve bu dürüstçe yansıtılıyor: yeniden ifade
 * gerçekten eşleşme kazandırmadıysa skor da değişmiyor.
 */
export async function rescore(
  input: { profile: ResumeProfile; posting: JobPostingData; draft: AdaptationDraft },
  embedding: EmbeddingProvider,
): Promise<number> {
  const adapted = applyAdaptation(input.profile, input.draft)
  const evidenceList = collectEvidence(adapted)
  const evidenceTexts = evidenceList.map((k) => k.text)
  const conceptTextList = conceptTexts(input.posting)

  // Tek toplu çağrı: kanıtlar önce, kavramlar sonra (Sprint 1'deki sıra).
  const vecs = await embedding.embed([...evidenceTexts, ...conceptTextList])

  return score({
    profile: adapted,
    posting: input.posting,
    evidence: evidenceList,
    evidenceVectors: vecs.slice(0, evidenceTexts.length),
    conceptVectors: vecs.slice(evidenceTexts.length),
  }).score
}
