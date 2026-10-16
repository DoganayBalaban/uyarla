/**
 * Analiz adresleri. Sunucu bileşenleri de kullanıyor; bu yüzden tarayıcı
 * deposundan (activeAnalysis.ts) ayrı.
 */

/** Sonucun kalıcı adresi (sayfa yenilense de açılır). */
export function resultPath(analysisId: string): string {
  return `/analyze?analiz=${encodeURIComponent(analysisId)}`
}

/**
 * Girişten ya da paket ekranından dönüş: `?uyarla=<analiz>`. Adres hemen
 * kalıcı sonuca çevriliyor; `?uyarla=` geçmişte kalırsa paket ekranından geri
 * tuşuyla dönen kullanıcı uyarlamayı yeniden tetikleyip yine oraya düşüyordu.
 */
export function resumeRequest(search: string): { analysisId: string; address: string } | null {
  const analysisId = new URLSearchParams(search).get("uyarla")
  return analysisId ? { analysisId, address: resultPath(analysisId) } : null
}
