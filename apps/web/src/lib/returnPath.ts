/**
 * Girişten sonra dönülecek adres.
 *
 * Adres URL'den geliyor, yani kullanıcı kontrolünde: doğrulanmazsa
 * `/login?donus=https://kotu.site` giriş sonrası kullanıcıyı başka bir
 * siteye yollar (open redirect). Yalnızca site içi mutlak yollar kabul
 * ediliyor; geri kalan her şey varsayılana düşüyor.
 */
export const DEFAULT_RETURN_PATH = "/analyze"

export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_RETURN_PATH
  const address = raw.trim()

  // "/" ile başlamalı ama "//" (protokolsüz dış adres) ya da "/\" (bazı
  // tarayıcılar "//" gibi yorumluyor) olmamalı.
  if (!address.startsWith("/") || address.startsWith("//") || address.startsWith("/\\")) {
    return DEFAULT_RETURN_PATH
  }
  // Kontrol karakterleri (sekme, satır sonu) tarayıcıda atılıp "//" ortaya
  // çıkarabiliyor.
  if (/[\u0000-\u001f\u007f]/.test(address)) return DEFAULT_RETURN_PATH

  // Son savunma: URL olarak çözülünce köken değişmemeli.
  try {
    const resolved = new URL(address, "https://uyarla.local")
    if (resolved.origin !== "https://uyarla.local") return DEFAULT_RETURN_PATH
    // Giriş ekranına geri dönmek döngü yaratır.
    if (resolved.pathname === "/login") return DEFAULT_RETURN_PATH
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return DEFAULT_RETURN_PATH
  }
}

/** Giriş bağlantısı: dönüş adresini kodlayarak ekliyor. */
export function loginPath(returnTo?: string): string {
  if (!returnTo || returnTo === DEFAULT_RETURN_PATH) return "/login"
  return `/login?donus=${encodeURIComponent(returnTo)}`
}
