/**
 * Giriş ekranının e-posta yardımcıları: yazım hatası önerisi ve "posta
 * uygulamasını aç" kısayolu. İkisi de yalnızca alan adına bakıyor.
 */

/** Türkiye'de yaygın posta sağlayıcıları; yazım önerisi bunlara göre. */
const YAYGIN_ALANLAR = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "yandex.com",
  "yandex.com.tr",
  "live.com",
  "msn.com",
  "protonmail.com",
]

/** Alan adından web posta adresi. Bilinmeyen alanda kısayol gösterilmiyor. */
/** `eylem` buton metni; Türkçe ek uygulamanın adına göre değişiyor. */
const POSTA_UYGULAMALARI: { alanlar: string[]; ad: string; eylem: string; url: string }[] = [
  { alanlar: ["gmail.com", "googlemail.com"], ad: "Gmail", eylem: "Gmail'i aç", url: "https://mail.google.com/mail/u/0/#inbox" },
  {
    alanlar: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.com.tr", "hotmail.com.tr"],
    ad: "Outlook", eylem: "Outlook'u aç",
    url: "https://outlook.live.com/mail/0/inbox",
  },
  { alanlar: ["yahoo.com", "ymail.com"], ad: "Yahoo Mail", eylem: "Yahoo Mail'i aç", url: "https://mail.yahoo.com" },
  { alanlar: ["icloud.com", "me.com", "mac.com"], ad: "iCloud Mail", eylem: "iCloud Mail'i aç", url: "https://www.icloud.com/mail" },
  { alanlar: ["yandex.com", "yandex.com.tr", "yandex.ru"], ad: "Yandex Mail", eylem: "Yandex Mail'i aç", url: "https://mail.yandex.com.tr" },
  { alanlar: ["protonmail.com", "proton.me"], ad: "Proton Mail", eylem: "Proton Mail'i aç", url: "https://mail.proton.me" },
]

function alanAdi(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const alan = email.slice(at + 1).trim().toLowerCase()
  return alan.includes(".") ? alan : null
}

export function postaUygulamasi(email: string): { ad: string; eylem: string; url: string } | null {
  const alan = alanAdi(email)
  if (!alan) return null
  const u = POSTA_UYGULAMALARI.find((p) => p.alanlar.includes(alan))
  return u ? { ad: u.ad, eylem: u.eylem, url: u.url } : null
}

/** Klasik düzenleme uzaklığı; komşu harf yer değiştirmesi 1 sayılıyor. */
function uzaklik(a: string, b: string): number {
  const w = b.length + 1
  const d = new Array<number>((a.length + 1) * w).fill(0)
  const al = (i: number, j: number) => d[i * w + j] ?? 0
  for (let i = 0; i <= a.length; i++) d[i * w] = i
  for (let j = 0; j <= b.length; j++) d[j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const maliyet = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(al(i - 1, j) + 1, al(i, j - 1) + 1, al(i - 1, j - 1) + maliyet)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, al(i - 2, j - 2) + 1)
      }
      d[i * w + j] = v
    }
  }
  return al(a.length, b.length)
}

/**
 * "ali@gmial.com" → "ali@gmail.com". Alan adı yaygın bir alana 1–2 harf
 * uzaklıktaysa öneriyor; tam eşleşme ya da uzak alan için null.
 *
 * Eşik bilerek dar: şirket alan adlarına (ör. "acme.com") yanlışlıkla
 * öneri yapmamak, bir yazım hatasını kaçırmaktan daha önemli.
 */
export function epostaOnerisi(email: string): string | null {
  const alan = alanAdi(email)
  if (!alan || YAYGIN_ALANLAR.includes(alan)) return null

  let enIyi: { alan: string; u: number } | null = null
  for (const aday of YAYGIN_ALANLAR) {
    const u = uzaklik(alan, aday)
    if (u <= 2 && (!enIyi || u < enIyi.u)) enIyi = { alan: aday, u }
  }
  if (!enIyi) return null
  return email.slice(0, email.lastIndexOf("@") + 1) + enIyi.alan
}
