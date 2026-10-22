/**
 * Sayfa HTML'inden ilan metni çıkarmak. Saf: ağa çıkmıyor.
 *
 * Web'in "ilanı bağlantıdan al" ucu (sunucu, izinli siteler) ve tarayıcı
 * eklentisi (kullanıcının açtığı sayfa, DOG-70) aynı kodu kullanıyor;
 * iki kopya zamanla ayrışırdı.
 */
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
  // Türkçe ilan sayfalarında (yenibiris) harfler adlandırılmış karakterle
  // geliyor; büyük/küçük harf ayrı anahtar.
  uuml: "ü",
  Uuml: "Ü",
  ouml: "ö",
  Ouml: "Ö",
  ccedil: "ç",
  Ccedil: "Ç",
  scedil: "ş",
  Scedil: "Ş",
  gbreve: "ğ",
  Gbreve: "Ğ",
  imath: "ı",
  Idot: "İ",
  acirc: "â",
  Acirc: "Â",
  icirc: "î",
  ucirc: "û",
  eacute: "é",
  euro: "€",
  laquo: "«",
  raquo: "»",
  middot: "·",
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, userName: string) => {
    if (userName[0] === "#") {
      const code = userName[1]?.toLowerCase() === "x" ? parseInt(userName.slice(2), 16) : parseInt(userName.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : full
    }
    return ENTITIES[userName] ?? ENTITIES[userName.toLowerCase()] ?? full
  })
}

/**
 * `hidden` özniteliği, `aria-hidden="true"` ya da satır içi `display:none` /
 * `visibility:hidden` taşıyan öğe ve içeriği. İç içe aynı etiket olursa en
 * içteki kapanışa kadar siliniyor; kalan parça görünür metin olarak kalır,
 * bu da güvenli yöndür.
 */
const HIDDEN_ELEMENT =
  /<(\w+)\b[^>]*?(?:\shidden(?=[\s=>])|aria-hidden=["']true["']|style=["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi

/** HTML'i okunur düz metne çevirir: paragraflar ve maddeler satır olarak. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Görünmez öğeler (DOG-121): ekranda okunmayan metin ilanın parçası
    // değil; içine yapay zekaya yönelik talimat gizlenebiliyor.
    .replace(HIDDEN_ELEMENT, " ")
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
    // Şirket çoğunlukla { name } nesnesi; yenibiris düz metin veriyor.
    const org = posting.hiringOrganization as { name?: unknown } | string | undefined
    const orgName = typeof org === "string" ? org : org?.name
    const company = typeof orgName === "string" ? decodeEntities(orgName).trim() || null : null
    // LinkedIn açıklamayı kodlanmış HTML olarak veriyor ("&lt;p&gt;"): etiketler
    // ancak çözüldükten sonra temizlenebiliyor.
    const description = /&lt;\/?[a-z]/i.test(posting.description) ? decodeEntities(posting.description) : posting.description
    const descriptionText = htmlToText(description)
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
  /** İlanın başladığı satır; yoksa metin baştan alınıyor. */
  startedAt?: RegExp
  ending: RegExp[]
  /** <title>'dan pozisyon adını temizler. */
  titleText?: (raw: string) => string
  /**
   * JSON-LD açıklaması kısaltılmış: ilan sayfa gövdesinden okunuyor. Pozisyon
   * ve şirket yine JSON-LD'den.
   */
  preferPage?: boolean
}

const COMMON_ENDINGS = [/^Benzer İlanlar$/i, /^Bu İlanla Birlikte Görüntülenenler$/i]

/**
 * LinkedIn'in herkese açık ilan sayfası (Ekim 2026): JSON-LD yayımlamıyor.
 * Açıklama "show-more-less-html__markup" kutusunda; pozisyon ve şirket üst
 * kartta. Sayfanın geri kalanı giriş çağrıları ve benzer ilan listeleri;
 * bunlar kutuya gelince analiz başka ilanların unvanlarını gereksinim sanıyordu.
 */
function linkedinPosting(html: string): ExtractedPosting | null {
  const markup = html.match(
    /<div class="show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<button class="show-more-less-html__button|<\/section>)/i,
  )?.[1]
  if (!markup) return null
  const description = htmlToText(markup)
  if (description.length < 100) return null
  const clean = (raw: string | undefined) => (raw ? decodeEntities(raw).replace(/\s+/g, " ").trim() || null : null)
  const position = clean(html.match(/class="[^"]*\btopcard__title\b[^"]*"[^>]*>([^<]*)</i)?.[1])
  const company = clean(html.match(/class="[^"]*\btopcard__org-name-link\b[^"]*"[^>]*>([^<]*)</i)?.[1])
  const heading = [position, company].filter(Boolean).join(" — ")
  return { text: heading ? `${heading}\n\n${description}` : description, position, company, source: "sayfa" }
}

const SITE_RULES: SiteRule[] = [
  {
    domain: "kariyer.net",
    startedAt: /^İş İlanı Hakkında$/i,
    ending: [/^İşverenlerin/i, /^Şirket Hakkında$/i, /^Bu Pozisyon İçin Sık Paylaşılan Maaşlar$/i],
    // "Dija & Co Sosyal Medya Uzmanı İş İlanı - 26.09.2026"
    titleText: (raw) => raw.replace(/\s*İş İlanı\s*-.*$/i, "").trim(),
  },
  {
    // Açıklama kutusu bulunamazsa (LinkedIn düzeni değişirse) sayfa metni
    // kriterler ve benzer ilanlar başlamadan kesiliyor.
    domain: "linkedin.com",
    ending: [
      /^(Kıdem düzeyi|Seniority level)$/i,
      /^(Benzer iş ilanları|Similar jobs)$/i,
      /^(Diğer görüntülenenler|People also viewed)$/i,
      /^(Show more|Show less|Daha fazla göster|Daha az göster)$/i,
    ],
  },
  {
    // JSON-LD açıklaması ~600 karakterde kelime ortasında kesiliyor (Ekim 2026).
    domain: "yenibiris.com",
    startedAt: /^İş Tanımı$/i,
    ending: [/^Özet Bilgiler$/i],
    preferPage: true,
  },
]

function findRule(host: string | undefined): SiteRule | undefined {
  if (!host) return undefined
  return SITE_RULES.find((k) => host === k.domain || host.endsWith(`.${k.domain}`))
}

/** Metni site kuralının başlangıç ve bitiş işaretleri arasına kırpar. */
function truncate(text: string, rule: SiteRule | undefined): string {
  let rows = text.split("\n")
  if (rule?.startedAt) {
    const startedAt = rule.startedAt
    const head = rows.findIndex((s) => startedAt.test(s.trim()))
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
  const rule = findRule(host)
  const configured = jsonLdPosting(html)
  if (configured && configured.text.length >= 100 && !rule?.preferPage) return configured
  if (rule?.domain === "linkedin.com") {
    const linkedin = linkedinPosting(html)
    if (linkedin) return linkedin
  }

  // Ana içerik: <main> ya da <article> varsa o, yoksa <body>. Menü ve alt
  // bilgi ayrıca atılıyor.
  const body =
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ??
    html
  const clean = body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ")
  const bodyText = truncate(htmlToText(clean), rule)
  if (bodyText.length < 200) return configured && configured.text.length >= 100 ? configured : null

  const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const titleText = rawTitle ? decodeEntities(rawTitle).trim() : null
  const position =
    configured?.position ?? (titleText && rule?.titleText ? rule.titleText(titleText) : titleText)
  const company = configured?.company ?? null
  const heading = [position, company].filter(Boolean).join(" — ")
  return {
    text: heading ? `${heading}\n\n${bodyText}` : bodyText,
    position,
    company,
    source: "sayfa",
  }
}
