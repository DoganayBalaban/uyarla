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
  const uyarlanmis = applyAdaptation(input.profile, input.draft)
  const kanitlar = collectEvidence(uyarlanmis)
  const kanitMetinleri = kanitlar.map((k) => k.text)
  const kavramMetinleri = conceptTexts(input.posting)

  // Tek toplu çağrı: kanıtlar önce, kavramlar sonra (Sprint 1'deki sıra).
  const vektorler = await embedding.embed([...kanitMetinleri, ...kavramMetinleri])

  return score({
    profile: uyarlanmis,
    posting: input.posting,
    evidence: kanitlar,
    evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
    conceptVectors: vektorler.slice(kanitMetinleri.length),
  }).score
}
