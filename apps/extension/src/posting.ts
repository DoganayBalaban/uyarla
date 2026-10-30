import { extractPostingText, type ExtractedPosting } from "@uyarla/core/jobPosting/extract"

/** Analiz formunun alt sınırıyla aynı (web `MIN_JOB_TEXT_LENGTH`). */
export const MIN_JOB_TEXT_LENGTH = 50
/** URL'ye konan metnin üst sınırı; ilanların büyük çoğunluğu bunun altında. */
export const MAX_EXTENSION_TEXT = 20000

/**
 * Açık sayfadaki ilan; bulunamazsa ya da çok kısaysa null. `marked`: yalnızca
 * sayfa açıkça bir ilansa (DOG-169, kendiliğinden çıkan düğme için).
 */
export function readPosting(page: { html: string; url: string }, options: { marked?: boolean } = {}): ExtractedPosting | null {
  let host: string | undefined
  try {
    host = new URL(page.url).hostname
  } catch {
    host = undefined
  }
  const posting = extractPostingText(page.html, host)
  if (!posting || posting.text.trim().length < MIN_JOB_TEXT_LENGTH) return null
  if (options.marked && !posting.marked) return null
  return { ...posting, text: posting.text.trim() }
}

/** Açık sayfadan ilan metni; bulunamazsa null (uyarla açılmaz, bildirim çıkar). */
export function pickPosting(page: { html: string; url: string }): string | null {
  return readPosting(page)?.text ?? null
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
export function uyarlaUrl(base: string, text: string, sourceUrl: string | null, token?: string): string {
  let capped = text.slice(0, MAX_EXTENSION_TEXT)
  // Kırpma bir emojinin yarısında kalırsa encodeURIComponent hata veriyor.
  if (/[\uD800-\uDBFF]$/.test(capped)) capped = capped.slice(0, -1)
  const parts = [`ilan=${encodeURIComponent(capped)}`]
  if (sourceUrl) parts.push(`kaynak=${encodeURIComponent(sourceUrl)}`)
  // Sayfa kendiliğinden göndermeden önce bu jetonu eklentiye soruyor (DOG-71).
  if (token) parts.push(`jeton=${encodeURIComponent(token)}`)
  return `${base.replace(/\/+$/, "")}/analyze#${parts.join("&")}`
}
