/**
 * Süren analizin tarayıcıdaki kaydı.
 *
 * Analiz yerel modelde dakikalar sürebiliyor ve kullanıcı bu sırada başka
 * sayfalara geçiyor. Kayıt localStorage'da tutuluyor ki sayfa değişse,
 * yenilense, hatta ikinci sekme açılsa bile sağ alttaki bildirim analizi
 * izlemeye devam etsin ve bitince haber versin.
 *
 * Tek bir analiz izleniyor: yeni analiz eskisinin kaydının yerine geçer.
 */

export type AktifAnalizDurumu = "running" | "completed" | "failed"

export interface AktifAnaliz {
  jobId: string
  baslangic: number
  durum: AktifAnalizDurumu
  /** Son bildirilen aşama (cv_okunuyor, ilan_okunuyor, karsilastiriliyor). */
  asama?: string
  analysisId?: string
  skor?: number
  hata?: string
  /** Kullanıcı sonucu gördü; bildirim artık gösterilmez. */
  goruldu?: boolean
}

const ANAHTAR = "uyarla:aktif-analiz"
/** Aynı sekmedeki dinleyiciler için; `storage` olayı yalnızca diğer sekmelerde tetiklenir. */
export const AKTIF_ANALIZ_OLAYI = "uyarla:aktif-analiz"

export function aktifAnaliziOku(): AktifAnaliz | null {
  try {
    const ham = window.localStorage.getItem(ANAHTAR)
    if (!ham) return null
    const kayit = JSON.parse(ham) as AktifAnaliz
    return typeof kayit?.jobId === "string" ? kayit : null
  } catch {
    // Gizli pencere ya da engellenmiş depolama: bildirim çalışmaz, analiz
    // sayfası yine çalışır.
    return null
  }
}

function yaz(kayit: AktifAnaliz | null): void {
  try {
    if (kayit) window.localStorage.setItem(ANAHTAR, JSON.stringify(kayit))
    else window.localStorage.removeItem(ANAHTAR)
  } catch {
    // bkz. aktifAnaliziOku
  }
  window.dispatchEvent(new Event(AKTIF_ANALIZ_OLAYI))
}

export function aktifAnaliziBaslat(jobId: string): void {
  yaz({ jobId, baslangic: Date.now(), durum: "running" })
}

/** Kaydı günceller; kayıt başka bir işe aitse dokunmaz. */
export function aktifAnaliziGuncelle(jobId: string, degisiklik: Partial<AktifAnaliz>): void {
  const kayit = aktifAnaliziOku()
  if (!kayit || kayit.jobId !== jobId) return
  yaz({ ...kayit, ...degisiklik })
}

export function aktifAnaliziTemizle(): void {
  yaz(null)
}

/** Yoklama yanıtını kayda işler; analiz sayfası ve bildirim aynı kuralı kullanıyor. */
export function yanitiIsle(
  jobId: string,
  yanit: { status: string; stage?: string; analysisId?: string | null; score?: number | null; error?: string },
): void {
  if (yanit.status === "completed") {
    aktifAnaliziGuncelle(jobId, {
      durum: "completed",
      analysisId: yanit.analysisId ?? undefined,
      skor: yanit.score ?? undefined,
    })
  } else if (yanit.status === "failed") {
    aktifAnaliziGuncelle(jobId, { durum: "failed", hata: yanit.error })
  } else if (yanit.stage) {
    aktifAnaliziGuncelle(jobId, { asama: yanit.stage })
  }
}

/** Kullanıcıya gösterilecek kısa aşama adı. */
export const ASAMA_KISA: Record<string, string> = {
  cv_okunuyor: "CV'ni okuyoruz",
  ilan_okunuyor: "İlanı okuyoruz",
  karsilastiriliyor: "İlanla karşılaştırıyoruz",
}

/** Sonucun kalıcı adresi (sayfa yenilense de açılır). */
export function sonucAdresi(analysisId: string): string {
  return `/analyze?analiz=${encodeURIComponent(analysisId)}`
}
