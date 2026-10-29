import { SCORING_REVISION } from "@uyarla/core/score/config"

/**
 * Skorun durum etiketi ve renkleri. Rehber §9.2 ve §9.5: skor rakam + durum
 * etiketiyle, renk tek başına değil.
 *
 * İstemci işaretsiz bir modülde, çünkü sunucu bileşenleri (dashboard) de
 * aynı eşikleri kullanıyor.
 *
 * Eşikler formül sürümüne göre; kayıtlı skor kendi formülünün eşiğiyle
 * etiketleniyor (eski analizin etiketi formül değişti diye düşmesin).
 * - Sürüm 3 (DOG-165, 29 Ekim 2026, 20 çift): düşük beklenenler 0–25, orta
 *   beklenenler 17–45, yüksek beklenenler 37–80 aldı. Orta ≥ 30, Yüksek ≥ 50:
 *   20 çiftin 18'i beklenen etiketi alıyor ("yarısından fazlası CV'nde
 *   kanıtlı" diye anlatılabiliyor). Kalan ikisi gerçek eksik: 5 yıl isteyen
 *   ilana 1 yıllık CV ve profesyonel GenAI deneyimi isteyen ilana yeni mezun.
 * - Sürüm 1–2 (DOG-103, 18 Ekim 2026): Orta ≥ 22, Yüksek ≥ 35.
 */
export function scoreStatus(
  score: number,
  revision: number = SCORING_REVISION,
): { label: string; textClass: string; strokeClass: string; bgClass: string } {
  const { medium, high } = revision >= 3 ? { medium: 30, high: 50 } : { medium: 22, high: 35 }
  if (score >= high) return { label: "Yüksek uyum", textClass: "text-brand-green", strokeClass: "stroke-brand-green", bgClass: "bg-brand-green/10" }
  if (score >= medium) return { label: "Orta uyum", textClass: "text-brand-amber", strokeClass: "stroke-brand-amber", bgClass: "bg-brand-amber/10" }
  return { label: "Düşük uyum", textClass: "text-brand-red", strokeClass: "stroke-brand-red", bgClass: "bg-brand-red/10" }
}
