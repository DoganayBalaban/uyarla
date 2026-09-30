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
export const IZINLI_ALANLAR = [
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

export function izinliAdres(ham: string): URL | null {
  let url: URL
  try {
    url = new URL(ham.trim())
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
  const izinli = IZINLI_ALANLAR.some((a) => host === a || host.endsWith(`.${a}`))
  if (!izinli) return null
  url.protocol = "https:"
  return url
}

const VARLIKLAR: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
}

function varlikCoz(metin: string): string {
  return metin.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tam, ad: string) => {
    if (ad[0] === "#") {
      const kod = ad[1]?.toLowerCase() === "x" ? parseInt(ad.slice(2), 16) : parseInt(ad.slice(1), 10)
      return Number.isFinite(kod) && kod > 0 && kod < 0x110000 ? String.fromCodePoint(kod) : tam
    }
    return VARLIKLAR[ad.toLowerCase()] ?? tam
  })
}

/** HTML'i okunur düz metne çevirir: paragraflar ve maddeler satır olarak. */
export function htmlMetin(html: string): string {
  const metin = html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|h[1-6]|section|article|tr|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
  return varlikCoz(varlikCoz(metin))
    .split("\n")
    // Satır içi etiketlerin yerine konan boşluk "nitelikler :" gibi
    // noktalamadan önce boşluk bırakıyor; o temizleniyor.
    .map((s) => s.replace(/[ \t\u00a0]+/g, " ").replace(/ ([,.;:!?])/g, "$1").trim())
    .filter((s, i, dizi) => s || (i > 0 && dizi[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export interface CikanIlan {
  metin: string
  pozisyon: string | null
  sirket: string | null
  kaynak: "json-ld" | "sayfa"
}

/** JSON-LD içinde JobPosting arar; @graph ve dizi biçimlerini de dolaşır. */
function jobPostingBul(dugum: unknown): Record<string, unknown> | null {
  if (!dugum || typeof dugum !== "object") return null
  if (Array.isArray(dugum)) {
    for (const d of dugum) {
      const bulunan = jobPostingBul(d)
      if (bulunan) return bulunan
    }
    return null
  }
  const nesne = dugum as Record<string, unknown>
  const tip = nesne["@type"]
  if (tip === "JobPosting" || (Array.isArray(tip) && tip.includes("JobPosting"))) return nesne
  return jobPostingBul(nesne["@graph"])
}

function jsonLdIlan(html: string): CikanIlan | null {
  const bloklar = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const [, icerik] of bloklar) {
    let veri: unknown
    try {
      veri = JSON.parse(icerik!.trim())
    } catch {
      continue
    }
    const ilan = jobPostingBul(veri)
    if (!ilan || typeof ilan.description !== "string") continue

    const pozisyon = typeof ilan.title === "string" ? varlikCoz(ilan.title).trim() : null
    const org = ilan.hiringOrganization as { name?: unknown } | undefined
    const sirket = typeof org?.name === "string" ? varlikCoz(org.name).trim() : null
    const aciklama = htmlMetin(ilan.description)
    const baslik = [pozisyon, sirket].filter(Boolean).join(" — ")
    return {
      metin: baslik ? `${baslik}\n\n${aciklama}` : aciklama,
      pozisyon,
      sirket,
      kaynak: "json-ld",
    }
  }
  return null
}

/**
 * JSON-LD yayımlamayan sitelerde sayfa metninin hangi aralığı ilan. Metin
 * işaretleri ölçülerek seçildi (Kariyer.net ilan sayfası, Eylül 2026):
 * ilan "İş İlanı Hakkında" başlığıyla başlıyor, ardından mülakat provası
 * reklamı, şirket tanıtımı, maaş aralıkları ve benzer ilanlar geliyor.
 * Maaş aralığı özellikle zararlı: çıkarıcı onu gereksinim sanabilir.
 */
interface SiteKurali {
  alan: string
  baslangic: RegExp
  bitis: RegExp[]
  /** <title>'dan pozisyon adını temizler. */
  baslik?: (ham: string) => string
}

const GENEL_BITIS = [/^Benzer İlanlar$/i, /^Bu İlanla Birlikte Görüntülenenler$/i]

const SITE_KURALLARI: SiteKurali[] = [
  {
    alan: "kariyer.net",
    baslangic: /^İş İlanı Hakkında$/i,
    bitis: [/^İşverenlerin/i, /^Şirket Hakkında$/i, /^Bu Pozisyon İçin Sık Paylaşılan Maaşlar$/i],
    // "Dija & Co Sosyal Medya Uzmanı İş İlanı - 26.09.2026"
    baslik: (ham) => ham.replace(/\s*İş İlanı\s*-.*$/i, "").trim(),
  },
]

function kuralBul(host: string | undefined): SiteKurali | undefined {
  if (!host) return undefined
  return SITE_KURALLARI.find((k) => host === k.alan || host.endsWith(`.${k.alan}`))
}

/** Metni site kuralının başlangıç ve bitiş işaretleri arasına kırpar. */
function kirp(metin: string, kural: SiteKurali | undefined): string {
  let satirlar = metin.split("\n")
  if (kural) {
    const bas = satirlar.findIndex((s) => kural.baslangic.test(s.trim()))
    if (bas !== -1) satirlar = satirlar.slice(bas + 1)
  }
  const bitisler = [...(kural?.bitis ?? []), ...GENEL_BITIS]
  const son = satirlar.findIndex((s) => bitisler.some((b) => b.test(s.trim())))
  if (son !== -1) satirlar = satirlar.slice(0, son)
  return satirlar.join("\n").trim()
}

/**
 * Sayfadan ilan metni. Önce yapılandırılmış veri (JSON-LD JobPosting):
 * iş ilanı siteleri Google for Jobs için bunu yayımlıyor ve menü, çerez
 * bandı gibi gürültü içermiyor. Yoksa sayfanın ana içeriği.
 */
export function ilanMetniCikar(html: string, host?: string): CikanIlan | null {
  const yapilandirilmis = jsonLdIlan(html)
  if (yapilandirilmis && yapilandirilmis.metin.length >= 100) return yapilandirilmis

  // Ana içerik: <main> ya da <article> varsa o, yoksa <body>. Menü ve alt
  // bilgi ayrıca atılıyor.
  const govde =
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ??
    html
  const temiz = govde.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ")
  const kural = kuralBul(host)
  const govdeMetni = kirp(htmlMetin(temiz), kural)
  if (govdeMetni.length < 200) return null

  const hamBaslik = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const baslik = hamBaslik ? varlikCoz(hamBaslik).trim() : null
  const pozisyon = baslik && kural?.baslik ? kural.baslik(baslik) : baslik
  return {
    metin: pozisyon ? `${pozisyon}\n\n${govdeMetni}` : govdeMetni,
    pozisyon,
    sirket: null,
    kaynak: "sayfa",
  }
}
