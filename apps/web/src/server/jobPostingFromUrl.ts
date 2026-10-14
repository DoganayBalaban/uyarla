/**
 * İlan bağlantısından ilan metnini çıkarmak.
 *
 * Güvenlik: sunucu kullanıcının verdiği adresi indiriyor, yani SSRF riski
 * var (iç ağdaki bir adrese istek attırmak). Genel bir engel listesi
 * (localhost, özel IP'ler) DNS hileleriyle aşılabiliyor; bu yüzden tersine
 * gidiliyor: yalnızca bilinen iş ilanı sitelerine istek atılıyor. Yönlendirme
 * her adımda aynı listeye karşı yeniden kontrol ediliyor (route.ts).
 *
 * Bu dosya saf: ağa çıkmıyor, test edilebilir.
 */

/** Alan adı ve tüm alt alan adları kabul. */
export const ALLOWED_PREFIXES = [
  "kariyer.net",
  "linkedin.com",
  "secretcv.com",
  "yenibiris.com",
  "eleman.net",
  "indeed.com",
  "glassdoor.com",
  "greenhouse.io",
  "lever.co",
  "workable.com",
  "myworkdayjobs.com",
] as const

export function isAllowedPath(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  // Kimlik bilgisi taşıyan adres (https://kullanici@site) ve standart dışı
  // port izin verilen sitelerde de gerekmiyor.
  if (url.username || url.password || (url.port && url.port !== "443" && url.port !== "80")) {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  const allowed = ALLOWED_PREFIXES.some((a) => host === a || host.endsWith(`.${a}`))
  if (!allowed) return null
  url.protocol = "https:"
  return url
}

// Çıkarma kodu core'da: tarayıcı eklentisi de kullanıyor (DOG-70).
export { extractPostingText, htmlToText, type ExtractedPosting } from "@uyarla/core/jobPosting/extract"
