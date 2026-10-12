/**
 * Skorun durum etiketi ve renkleri. Rehber §9.2 ve §9.5: skor rakam + durum
 * etiketiyle, renk tek başına değil.
 *
 * İstemci işaretsiz bir modülde, çünkü sunucu bileşenleri (dashboard) de
 * aynı eşikleri kullanıyor.
 *
 * Eşikler değerlendirme setinden (DOG-66, 12 Ekim 2026, 18 çift): yüksek uyum
 * beklenen çiftler 24–59, düşük beklenenler 0–18 aldı. Eski 40/70 eşiğinde
 * iyi uyumlu CV'lerin hiçbiri "Yüksek" görmüyordu; 20/30 ile 18 çiftin 14'ü
 * beklenen etiketi alıyor (önce 9). Skor, CV'nin lafzen karşılayamadığı soft
 * gereksinimler de paydada olduğu için düşük seyrediyor. K2 testinden sonra
 * yeniden ayarlanmalı.
 */
export function scoreStatus(score: number): { label: string; textClass: string; strokeClass: string; bgClass: string } {
  if (score >= 30) return { label: "Yüksek uyum", textClass: "text-brand-green", strokeClass: "stroke-brand-green", bgClass: "bg-brand-green/10" }
  if (score >= 20) return { label: "Orta uyum", textClass: "text-brand-amber", strokeClass: "stroke-brand-amber", bgClass: "bg-brand-amber/10" }
  return { label: "Düşük uyum", textClass: "text-brand-red", strokeClass: "stroke-brand-red", bgClass: "bg-brand-red/10" }
}
