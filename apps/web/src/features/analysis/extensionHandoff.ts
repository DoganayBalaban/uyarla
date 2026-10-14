import { MIN_JOB_TEXT_LENGTH } from "@/features/analysis/schema"

/**
 * Tarayıcı eklentisinden gelen ilan (DOG-70).
 *
 * Eklenti uyarla'yı `/analyze#ilan=<metin>&kaynak=<sayfa>` ile açıyor.
 * `#` kısmı sunucuya gitmiyor: ilan metni istek günlüklerine düşmüyor ve
 * yeni bir API ucu gerekmiyor.
 */
export interface ExtensionHandoff {
  jobText: string
  sourceUrl: string | null
}

export function readExtensionHandoff(hash: string, search: string): ExtensionHandoff | null {
  // Kalıcı sonuç adresi (?analiz=) sonucu gösteriyor; form doldurulmuyor.
  if (new URLSearchParams(search).has("analiz")) return null
  if (!hash.startsWith("#ilan=")) return null
  let params: URLSearchParams
  try {
    // URLSearchParams "+"yı boşluğa çeviriyor; eklenti encodeURIComponent
    // kullandığı için "+" zaten %2B. Bozuk kodlamayı decodeURIComponent yakalıyor.
    decodeURIComponent(hash.slice(1))
    params = new URLSearchParams(hash.slice(1))
  } catch {
    return null
  }
  const jobText = (params.get("ilan") ?? "").trim()
  if (jobText.length < MIN_JOB_TEXT_LENGTH) return null
  const source = params.get("kaynak")
  const sourceUrl = source && /^https?:\/\//i.test(source) ? source : null
  return { jobText, sourceUrl }
}

/** Kayıtlı kullanıcı ve ön seçili kütüphane CV'si varsa analiz beklemeden başlar. */
export function shouldAutoSubmit(input: { registered: boolean; resumeId: string | undefined; jobText: string }): boolean {
  return input.registered && !!input.resumeId && input.jobText.trim().length >= MIN_JOB_TEXT_LENGTH
}

/** Tek kullanımlık kapı: Strict Mode efekti iki kez çalıştırsa da bir gönderim. */
export function createAutoSubmitGate(): () => boolean {
  let open = true
  return () => {
    if (!open) return false
    open = false
    return true
  }
}
