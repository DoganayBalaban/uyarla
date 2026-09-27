/**
 * Girişten sonra dönülecek adres.
 *
 * Adres URL'den geliyor, yani kullanıcı kontrolünde: doğrulanmazsa
 * `/login?donus=https://kotu.site` giriş sonrası kullanıcıyı başka bir
 * siteye yollar (open redirect). Yalnızca site içi mutlak yollar kabul
 * ediliyor; geri kalan her şey varsayılana düşüyor.
 */
export const VARSAYILAN_DONUS = "/analyze"

export function guvenliDonus(ham: string | null | undefined): string {
  if (!ham) return VARSAYILAN_DONUS
  const adres = ham.trim()

  // "/" ile başlamalı ama "//" (protokolsüz dış adres) ya da "/\" (bazı
  // tarayıcılar "//" gibi yorumluyor) olmamalı.
  if (!adres.startsWith("/") || adres.startsWith("//") || adres.startsWith("/\\")) {
    return VARSAYILAN_DONUS
  }
  // Kontrol karakterleri (sekme, satır sonu) tarayıcıda atılıp "//" ortaya
  // çıkarabiliyor.
  if (/[\u0000-\u001f\u007f]/.test(adres)) return VARSAYILAN_DONUS

  // Son savunma: URL olarak çözülünce köken değişmemeli.
  try {
    const cozulen = new URL(adres, "https://uyarla.local")
    if (cozulen.origin !== "https://uyarla.local") return VARSAYILAN_DONUS
    // Giriş ekranına geri dönmek döngü yaratır.
    if (cozulen.pathname === "/login") return VARSAYILAN_DONUS
    return cozulen.pathname + cozulen.search + cozulen.hash
  } catch {
    return VARSAYILAN_DONUS
  }
}

/** Giriş bağlantısı: dönüş adresini kodlayarak ekliyor. */
export function girisAdresi(donus?: string): string {
  if (!donus || donus === VARSAYILAN_DONUS) return "/login"
  return `/login?donus=${encodeURIComponent(donus)}`
}
