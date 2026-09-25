import type { Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import { checkSemanticDrift } from "./drift.js"
import { checkPostingTermInjection } from "./injection.js"
import { checkNumbers } from "./numbers.js"

export interface VerificationConfig {
  /** Altında anlamsal sapma sayılan kosinüs benzerliği. */
  driftThreshold: number
}

/**
 * Başlangıç değeri; Görev 14'te değerlendirme setiyle ayarlanacak (spec §7.3).
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  driftThreshold: 0.75,
}

export interface VerifyInput {
  rewritten: string
  /** Ham CV metnindeki birebir karşılık — doğrulamanın tek kaynağı. */
  source: string
  posting: JobPostingData
  /**
   * Anlamsal sapma kontrolü için vektörler. Verilmezse o kontrol atlanır;
   * kesin olan ilk iki kontrol yine çalışır.
   */
  vectors?: { rewritten: number[]; source: number[] }
}

/**
 * Bir yeniden yazımı üç deterministik kontrolden geçirir (spec §7).
 *
 * Saf fonksiyon: LLM çağırmaz, ağa çıkmaz. Sprint 1'in dersi gereği yargıyı
 * modele bırakmıyoruz — LLM hakem, uydurmayı uydurmayla denetlemek olurdu
 * (K-28).
 */
export function verifyRewrite(
  input: VerifyInput,
  cfg: VerificationConfig = DEFAULT_VERIFICATION_CONFIG,
): Verification {
  const issues = [
    ...checkNumbers(input.rewritten, input.source),
    ...checkPostingTermInjection(input.rewritten, input.source, input.posting),
    ...(input.vectors
      ? checkSemanticDrift(input.vectors.rewritten, input.vectors.source, cfg.driftThreshold)
      : []),
  ]

  return { status: issues.length > 0 ? "flagged" : "ok", issues }
}
