import { cosineSimilarity } from "../llm/embedding.js"
import type { VerificationIssue } from "../schemas/adaptation.js"

/**
 * Yeniden yazımın kaynaktan anlamca uzaklaşıp uzaklaşmadığını ölçer
 * (spec §7.3).
 *
 * Terim eklemeden anlamı abartmayı yakalar: "kod inceleme sürecine katkı
 * sağladım" → "kod inceleme sürecini kurdum ve ekibe liderlik ettim".
 *
 * İKİNCİL kontrol: eşik bir tahmindir, diğer ikisi gibi kesin gerekçe
 * üretmez. Kapsam kesme sırasında ikinci sırada (spec §16).
 */
export function checkSemanticDrift(
  rewrittenVector: number[],
  sourceVector: number[],
  threshold: number,
): VerificationIssue[] {
  const benzerlik = cosineSimilarity(rewrittenVector, sourceVector)
  if (benzerlik >= threshold) return []

  return [
    {
      kind: "semantic_drift",
      detail:
        "Bu madde senin yazdığından epey uzaklaşmış görünüyor. " +
        "Anlatılan işin aynı kaldığından emin ol.",
    },
  ]
}
