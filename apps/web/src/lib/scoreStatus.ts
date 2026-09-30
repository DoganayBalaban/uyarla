/**
 * Skorun durum etiketi ve renkleri. Rehber §9.2 ve §9.5: skor rakam + durum
 * etiketiyle, renk tek başına değil.
 *
 * İstemci işaretsiz bir modülde, çünkü sunucu bileşenleri (dashboard) de
 * aynı eşikleri kullanıyor.
 */
export function scoreStatus(score: number): { label: string; textClass: string; strokeClass: string; bgClass: string } {
  if (score >= 70) return { label: "Yüksek uyum", textClass: "text-yesil", strokeClass: "stroke-yesil", bgClass: "bg-yesil/10" }
  if (score >= 40) return { label: "Orta uyum", textClass: "text-kehribar", strokeClass: "stroke-kehribar", bgClass: "bg-kehribar/10" }
  return { label: "Düşük uyum", textClass: "text-kirmizi", strokeClass: "stroke-kirmizi", bgClass: "bg-kirmizi/10" }
}
