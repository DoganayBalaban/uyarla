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

/**
 * İlanın herkese açık adresi. LinkedIn'de giriş isteyen liste sayfalarından
 * (`/jobs/collections/…?currentJobId=`, `/jobs/search/?currentJobId=`)
 * kopyalanan bağlantı giriş sayfasına yönleniyordu ve kutuya giriş ekranının
 * metni geliyordu; ilan numarası herkese açık `/jobs/view/<numara>`
 * sayfasına çevriliyor.
 */
export function canonicalPostingUrl(url: URL): URL {
  const host = url.hostname.toLowerCase()
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return url
  const fromQuery = url.searchParams.get("currentJobId")
  const fromPath = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/)?.[1]
  const id = fromQuery && /^\d{6,}$/.test(fromQuery) ? fromQuery : fromPath
  return id ? new URL(`https://www.linkedin.com/jobs/view/${id}`) : url
}

/** Yönlendirmenin gittiği yer bir giriş sayfası mı. */
export function isLoginPath(url: URL): boolean {
  return /^\/(uas\/login|login|authwall|checkpoint|signup|signin|sign-in|giris|uyelik\/giris)(\/|$|\?)/i.test(url.pathname)
}

/**
 * Sayfa ilan değil giriş ekranı mı: başlığı ve ilk satırı ölçülüyor. Uzun
 * bir ilan metninde "oturum aç" geçebilir; yalnızca başlıkta ve kısa
 * sayfada sayılıyor ("Login Experience Engineer" ilanı elenmesin).
 */
export function looksLikeLoginWall(posting: { text: string; position: string | null }): boolean {
  if (posting.text.length >= 2000) return false
  const head = [posting.position ?? "", posting.text.split("\n")[0] ?? ""].join(" ")
  return /oturum aç|giriş yap|sign ?in|log ?in|sign up|kayıt ol/i.test(head)
}

export const LOGIN_REQUIRED = {
  linkedin:
    "LinkedIn bu bağlantı için giriş istiyor, ilanı göremedik. İlanın kendi sayfasını aç (adreste /jobs/view/ geçsin) ve o bağlantıyı yapıştır; olmazsa ilan metnini kopyalayıp yapıştırabilirsin.",
  other:
    "Bu sayfa giriş istiyor, ilanı göremedik. İlanın herkese açık sayfasının bağlantısını dene ya da ilan metnini kopyalayıp yapıştır.",
}

// Çıkarma kodu core'da: tarayıcı eklentisi de kullanıyor (DOG-70).
export { extractPostingText, htmlToText, type ExtractedPosting } from "@uyarla/core/jobPosting/extract"
