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

const ENTITIES: Record<string, string> = {
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

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, userName: string) => {
    if (userName[0] === "#") {
      const code = userName[1]?.toLowerCase() === "x" ? parseInt(userName.slice(2), 16) : parseInt(userName.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : full
    }
    return ENTITIES[userName.toLowerCase()] ?? full
  })
}

/** HTML'i okunur düz metne çevirir: paragraflar ve maddeler satır olarak. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|h[1-6]|section|article|tr|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
  return decodeEntities(decodeEntities(text))
    .split("\n")
    // Satır içi etiketlerin yerine konan boşluk "nitelikler :" gibi
    // noktalamadan önce boşluk bırakıyor; o temizleniyor.
    .map((s) => s.replace(/[ \t\u00a0]+/g, " ").replace(/ ([,.;:!?])/g, "$1").trim())
    .filter((s, i, list) => s || (i > 0 && list[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export interface ExtractedPosting {
  text: string
  position: string | null
  company: string | null
  source: "json-ld" | "sayfa"
}

/** JSON-LD içinde JobPosting arar; @graph ve dizi biçimlerini de dolaşır. */
function findJobPosting(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const d of node) {
      const found = findJobPosting(d)
      if (found) return found
    }
    return null
  }
  const obj = node as Record<string, unknown>
  const typeName = obj["@type"]
  if (typeName === "JobPosting" || (Array.isArray(typeName) && typeName.includes("JobPosting"))) return obj
  return findJobPosting(obj["@graph"])
}

function jsonLdPosting(html: string): ExtractedPosting | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const [, content] of blocks) {
    let data: unknown
    try {
      data = JSON.parse(content!.trim())
    } catch {
      continue
    }
    const posting = findJobPosting(data)
    if (!posting || typeof posting.description !== "string") continue

    const position = typeof posting.title === "string" ? decodeEntities(posting.title).trim() : null
    const org = posting.hiringOrganization as { name?: unknown } | undefined
    const company = typeof org?.name === "string" ? decodeEntities(org.name).trim() : null
    const descriptionText = htmlToText(posting.description)
    const titleText = [position, company].filter(Boolean).join(" — ")
    return {
      text: titleText ? `${titleText}\n\n${descriptionText}` : descriptionText,
      position,
      company,
      source: "json-ld",
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
interface SiteRule {
  domain: string
  startedAt: RegExp
  ending: RegExp[]
  /** <title>'dan pozisyon adını temizler. */
  titleText?: (raw: string) => string
}

const COMMON_ENDINGS = [/^Benzer İlanlar$/i, /^Bu İlanla Birlikte Görüntülenenler$/i]

const SITE_RULES: SiteRule[] = [
  {
    domain: "kariyer.net",
    startedAt: /^İş İlanı Hakkında$/i,
    ending: [/^İşverenlerin/i, /^Şirket Hakkında$/i, /^Bu Pozisyon İçin Sık Paylaşılan Maaşlar$/i],
    // "Dija & Co Sosyal Medya Uzmanı İş İlanı - 26.09.2026"
    titleText: (raw) => raw.replace(/\s*İş İlanı\s*-.*$/i, "").trim(),
  },
]

function findRule(host: string | undefined): SiteRule | undefined {
  if (!host) return undefined
  return SITE_RULES.find((k) => host === k.domain || host.endsWith(`.${k.domain}`))
}

/** Metni site kuralının başlangıç ve bitiş işaretleri arasına kırpar. */
function truncate(text: string, rule: SiteRule | undefined): string {
  let rows = text.split("\n")
  if (rule) {
    const head = rows.findIndex((s) => rule.startedAt.test(s.trim()))
    if (head !== -1) rows = rows.slice(head + 1)
  }
  const endings = [...(rule?.ending ?? []), ...COMMON_ENDINGS]
  const endIndex = rows.findIndex((s) => endings.some((b) => b.test(s.trim())))
  if (endIndex !== -1) rows = rows.slice(0, endIndex)
  return rows.join("\n").trim()
}

/**
 * Sayfadan ilan metni. Önce yapılandırılmış veri (JSON-LD JobPosting):
 * iş ilanı siteleri Google for Jobs için bunu yayımlıyor ve menü, çerez
 * bandı gibi gürültü içermiyor. Yoksa sayfanın ana içeriği.
 */
export function extractPostingText(html: string, host?: string): ExtractedPosting | null {
  const configured = jsonLdPosting(html)
  if (configured && configured.text.length >= 100) return configured

  // Ana içerik: <main> ya da <article> varsa o, yoksa <body>. Menü ve alt
  // bilgi ayrıca atılıyor.
  const body =
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ??
    html
  const clean = body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ")
  const rule = findRule(host)
  const bodyText = truncate(htmlToText(clean), rule)
  if (bodyText.length < 200) return null

  const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const titleText = rawTitle ? decodeEntities(rawTitle).trim() : null
  const position = titleText && rule?.titleText ? rule.titleText(titleText) : titleText
  return {
    text: position ? `${position}\n\n${bodyText}` : bodyText,
    position,
    company: null,
    source: "sayfa",
  }
}
