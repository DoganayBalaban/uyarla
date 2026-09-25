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
 * Değerlendirme setiyle ayarlandı (K-33).
 *
 * Tarama, 93 madde üzerinde:
 *
 *   eşik   işaretlenen   sapma
 *   0.65   %1,1          0
 *   0.70   %1,1          0
 *   0.75   %4,3          3   ← üçü de yanlış alarm
 *   0.80   %15,1         13
 *   0.85   %37,6         35
 *
 * 0.75'te tetiklenen üç maddenin üçü de sadık İngilizce→Türkçe çeviriydi:
 * BGE-M3 çapraz dilli, ama çevrilmiş bir cümle yine 0,75–0,79 bandında
 * kalıyor, 0,9 değil. Eşik 0,70'e indi; bu veride hiç tetiklenmiyor ve
 * gerçekten savrulmuş bir yeniden yazım için emniyet supabı olarak duruyor.
 *
 * Kontrol bu sette HİÇ gerçek pozitif üretmedi; o yüzden geçici sayılmalı.
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  driftThreshold: 0.7,
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
