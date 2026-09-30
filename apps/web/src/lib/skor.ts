/**
 * Skorun durum etiketi ve renkleri. Rehber §9.2 ve §9.5: skor rakam + durum
 * etiketiyle, renk tek başına değil.
 *
 * İstemci işaretsiz bir modülde, çünkü sunucu bileşenleri (dashboard) de
 * aynı eşikleri kullanıyor.
 */
export function skorDurumu(skor: number): { etiket: string; renk: string; iz: string; zemin: string } {
  if (skor >= 70) return { etiket: "Yüksek uyum", renk: "text-yesil", iz: "stroke-yesil", zemin: "bg-yesil/10" }
  if (skor >= 40) return { etiket: "Orta uyum", renk: "text-kehribar", iz: "stroke-kehribar", zemin: "bg-kehribar/10" }
  return { etiket: "Düşük uyum", renk: "text-kirmizi", iz: "stroke-kirmizi", zemin: "bg-kirmizi/10" }
}
