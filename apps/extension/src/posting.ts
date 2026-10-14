import { extractPostingText } from "@uyarla/core/jobPosting/extract"

/** Analiz formunun alt sınırıyla aynı (web `MIN_JOB_TEXT_LENGTH`). */
export const MIN_JOB_TEXT_LENGTH = 50
/** URL'ye konan metnin üst sınırı; ilanların büyük çoğunluğu bunun altında. */
export const MAX_EXTENSION_TEXT = 20000

/** Açık sayfadan ilan metni; bulunamazsa null (uyarla açılmaz, bildirim çıkar). */
export function pickPosting(page: { html: string; url: string }): string | null {
  let host: string | undefined
  try {
    host = new URL(page.url).hostname
  } catch {
    host = undefined
  }
  const text = extractPostingText(page.html, host)?.text.trim() ?? ""
  return text.length >= MIN_JOB_TEXT_LENGTH ? text : null
}

/**
 * Sağ tık menüsünden gelen seçili metin. Chrome'un menü bilgisindeki metin
 * satır sonlarını kaybediyor (maddeler tek satıra iniyor); sayfadan okunan
 * seçim varsa o tercih ediliyor.
 */
export function pickSelection(menuText: string | undefined, pageText?: string): string | null {
  const text = (pageText?.trim() || menuText || "").trim()
  return text.length >= MIN_JOB_TEXT_LENGTH ? text : null
}

/**
 * uyarla'nın analiz sayfası, ilan metni `#` kısmında. `#` sunucuya gitmiyor:
 * metin istek günlüklerine düşmüyor. encodeURIComponent "+"yı da kodluyor;
 * web tarafı URLSearchParams ile okuyor (bkz. extensionHandoff.ts).
 */
export function uyarlaUrl(base: string, text: string, sourceUrl: string | null): string {
  let capped = text.slice(0, MAX_EXTENSION_TEXT)
  // Kırpma bir emojinin yarısında kalırsa encodeURIComponent hata veriyor.
  if (/[\uD800-\uDBFF]$/.test(capped)) capped = capped.slice(0, -1)
  const parts = [`ilan=${encodeURIComponent(capped)}`]
  if (sourceUrl) parts.push(`kaynak=${encodeURIComponent(sourceUrl)}`)
  return `${base.replace(/\/+$/, "")}/analyze#${parts.join("&")}`
}
