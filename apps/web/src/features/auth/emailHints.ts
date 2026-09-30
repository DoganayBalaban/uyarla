/**
 * Giriş ekranının e-posta yardımcıları: yazım hatası önerisi ve "posta
 * uygulamasını aç" kısayolu. İkisi de yalnızca alan adına bakıyor.
 */

/** Türkiye'de yaygın posta sağlayıcıları; yazım önerisi bunlara göre. */
const COMMON_DOMAINS = [
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
const MAIL_APPS: { domains: string[]; name: string; action: string; url: string }[] = [
  { domains: ["gmail.com", "googlemail.com"], name: "Gmail", action: "Gmail'i aç", url: "https://mail.google.com/mail/u/0/#inbox" },
  {
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.com.tr", "hotmail.com.tr"],
    name: "Outlook", action: "Outlook'u aç",
    url: "https://outlook.live.com/mail/0/inbox",
  },
  { domains: ["yahoo.com", "ymail.com"], name: "Yahoo Mail", action: "Yahoo Mail'i aç", url: "https://mail.yahoo.com" },
  { domains: ["icloud.com", "me.com", "mac.com"], name: "iCloud Mail", action: "iCloud Mail'i aç", url: "https://www.icloud.com/mail" },
  { domains: ["yandex.com", "yandex.com.tr", "yandex.ru"], name: "Yandex Mail", action: "Yandex Mail'i aç", url: "https://mail.yandex.com.tr" },
  { domains: ["protonmail.com", "proton.me"], name: "Proton Mail", action: "Proton Mail'i aç", url: "https://mail.proton.me" },
]

function domainName(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const domain = email.slice(at + 1).trim().toLowerCase()
  return domain.includes(".") ? domain : null
}

export function mailAppFor(email: string): { name: string; action: string; url: string } | null {
  const domain = domainName(email)
  if (!domain) return null
  const u = MAIL_APPS.find((p) => p.domains.includes(domain))
  return u ? { name: u.name, action: u.action, url: u.url } : null
}

/** Klasik düzenleme uzaklığı; komşu harf yer değiştirmesi 1 sayılıyor. */
function distance(a: string, b: string): number {
  const w = b.length + 1
  const d = new Array<number>((a.length + 1) * w).fill(0)
  const take = (i: number, j: number) => d[i * w + j] ?? 0
  for (let i = 0; i <= a.length; i++) d[i * w] = i
  for (let j = 0; j <= b.length; j++) d[j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(take(i - 1, j) + 1, take(i, j - 1) + 1, take(i - 1, j - 1) + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, take(i - 2, j - 2) + 1)
      }
      d[i * w + j] = v
    }
  }
  return take(a.length, b.length)
}

/**
 * "ali@gmial.com" → "ali@gmail.com". Alan adı yaygın bir alana 1–2 harf
 * uzaklıktaysa öneriyor; tam eşleşme ya da uzak alan için null.
 *
 * Eşik bilerek dar: şirket alan adlarına (ör. "acme.com") yanlışlıkla
 * öneri yapmamak, bir yazım hatasını kaçırmaktan daha önemli.
 */
export function suggestEmail(email: string): string | null {
  const domain = domainName(email)
  if (!domain || COMMON_DOMAINS.includes(domain)) return null

  let best: { domain: string; u: number } | null = null
  for (const candidate of COMMON_DOMAINS) {
    const u = distance(domain, candidate)
    if (u <= 2 && (!best || u < best.u)) best = { domain: candidate, u }
  }
  if (!best) return null
  return email.slice(0, email.lastIndexOf("@") + 1) + best.domain
}
