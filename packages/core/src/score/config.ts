/**
 * Skor sabitleri. Tek yerde toplanıyor; değerlendirme setinde (Görev 13)
 * ayarlanacak — koda dağılmıyor (spec §7).
 */
export interface ScoringConfig {
  /** "must" gereksinimlerinin ağırlığı. */
  mustWeight: number
  /** "nice" gereksinimlerinin ağırlığı. */
  niceWeight: number
  /** Bu değerin altındaki kosinüs benzerliği eşleşme sayılmaz. */
  semanticThreshold: number
}

/**
 * Başlangıç değerleri hipotezdir. Eşik bilinçli olarak yüksek: uydurma
 * eşleşme (yanlış pozitif), kaçırmadan daha zararlıdır — kullanıcıya olmayan
 * bir yetkinliği varmış gibi gösterir ve dürüstlük ilkesini çiğner (spec §7).
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  mustWeight: 2.0,
  niceWeight: 1.0,
  semanticThreshold: 0.65,
}
