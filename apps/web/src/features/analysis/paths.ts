/**
 * Analiz adresleri. Sunucu bileşenleri de kullanıyor; bu yüzden tarayıcı
 * deposundan (activeAnalysis.ts) ayrı.
 */

/** Sonucun kalıcı adresi (sayfa yenilense de açılır). */
export function resultPath(analysisId: string): string {
  return `/analyze?analiz=${encodeURIComponent(analysisId)}`
}
