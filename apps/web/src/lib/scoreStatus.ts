/**
 * Skorun durum etiketi ve renkleri. Rehber §9.2 ve §9.5: skor rakam + durum
 * etiketiyle, renk tek başına değil.
 *
 * İstemci işaretsiz bir modülde, çünkü sunucu bileşenleri (dashboard) de
 * aynı eşikleri kullanıyor.
 *
 * Eşikler değerlendirme setinden (DOG-103, 18 Ekim 2026, 20 çift), skor
 * formülünün 2. sürümüyle: soft gereksinimler skordan çıktı, unvan bir
 * zorunlu gibi girdi. Düşük beklenen çiftler 0–19, orta beklenenler 15–36,
 * yüksek beklenenler 37–83 aldı; 20 çiftin 17'si beklenen etiketi alıyor
 * (önceki formül ve 20/30 eşiğiyle 15). Canlıda "Yüksek uyum" görünen
 * muhasebe CV'si × İK ilanı 42'den 34'e indi ve "Orta".
 * Eski analizlerin kayıtlı skoru eski formülle; bu eşiklerde bir kademe
 * düşük görünebilirler.
 */
export function scoreStatus(score: number): { label: string; textClass: string; strokeClass: string; bgClass: string } {
  if (score >= 35) return { label: "Yüksek uyum", textClass: "text-brand-green", strokeClass: "stroke-brand-green", bgClass: "bg-brand-green/10" }
  if (score >= 22) return { label: "Orta uyum", textClass: "text-brand-amber", strokeClass: "stroke-brand-amber", bgClass: "bg-brand-amber/10" }
  return { label: "Düşük uyum", textClass: "text-brand-red", strokeClass: "stroke-brand-red", bgClass: "bg-brand-red/10" }
}
