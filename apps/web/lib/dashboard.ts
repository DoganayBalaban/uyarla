/**
 * Uygulama ana ekranının (dashboard) saf mantığı. Başvuru panosuyla aynı
 * kartları okuyor (lib/pano.ts); veritabanına dokunmuyor.
 *
 * Yalnızca kullanıcının kendi verisinden sayım var: ortalama skor artışı
 * ya da "başarı oranı" gibi kanıtsız bir sayı yok (rehber §11).
 */
import { sonucAdresi } from "./aktifAnaliz"
import { ASAMALAR, type Asama, type PanoKarti } from "./pano"

export type BekleyenTuru = "karar" | "hazir" | "uyarla"

export interface Bekleyen {
  tur: BekleyenTuru
  analysisId: string
  pozisyon: string
  adres: string
}

export interface DashboardOzeti {
  toplam: number
  asamaSayilari: Record<Asama, number>
  bekleyenler: Bekleyen[]
  sonAnalizler: PanoKarti[]
}

const BEKLEYEN_SIRASI: Record<BekleyenTuru, number> = { karar: 0, hazir: 1, uyarla: 2 }
const SON_ANALIZ_SAYISI = 5
const BEKLEYEN_SAYISI = 4

/**
 * Bir kart kullanıcıdan ne bekliyor:
 * - karar: uyarlamada işaretli maddeler var; karar verilmeden indirme kapalı.
 *   Aşamadan bağımsız, çünkü CV hâlâ indirilemiyor.
 * - hazir: CV hazır ama ilana henüz başvurulmadı.
 * - uyarla: skor alındı, uyarlanmadı, başvurulmadı.
 */
function bekledigi(k: PanoKarti): Bekleyen | null {
  const durum = k.uyarlama?.durum
  if (k.uyarlama && durum === "draft") {
    return { tur: "karar", analysisId: k.analysisId, pozisyon: k.pozisyon, adres: `/adapt/${k.uyarlama.id}` }
  }
  if (k.asama !== "saved") return null
  if (k.uyarlama && durum === "ready") {
    return { tur: "hazir", analysisId: k.analysisId, pozisyon: k.pozisyon, adres: `/adapt/${k.uyarlama.id}` }
  }
  if (!k.uyarlama) {
    return { tur: "uyarla", analysisId: k.analysisId, pozisyon: k.pozisyon, adres: sonucAdresi(k.analysisId) }
  }
  return null
}

const zaman = (k: PanoKarti) => Date.parse(k.olusturulma)

export function ozetle(kartlar: PanoKarti[]): DashboardOzeti {
  const asamaSayilari = Object.fromEntries(ASAMALAR.map((a) => [a, 0])) as Record<Asama, number>
  for (const k of kartlar) asamaSayilari[k.asama]++

  const yeniden = [...kartlar].sort((x, y) => zaman(y) - zaman(x))
  const bekleyenler = yeniden
    .map(bekledigi)
    .filter((b): b is Bekleyen => b !== null)
    // Sıralama kararlı: aynı türde en yeni analiz önde kalıyor.
    .sort((x, y) => BEKLEYEN_SIRASI[x.tur] - BEKLEYEN_SIRASI[y.tur])
    .slice(0, BEKLEYEN_SAYISI)

  return {
    toplam: kartlar.length,
    asamaSayilari,
    bekleyenler,
    sonAnalizler: yeniden.slice(0, SON_ANALIZ_SAYISI),
  }
}
