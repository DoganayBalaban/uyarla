/**
 * Dış ilan kaynakları (DOG-67, spike).
 *
 * LinkedIn, Indeed ve Kariyer.net'in ilan okuma API'si yok; kazımak kullanım
 * sözleşmelerine ve FSEK ek md. 8'e aykırı. Resmi erişimi olan iki toplayıcı
 * kullanılıyor; ikisi de birçok sitenin ilanını topluyor (`origin`).
 *
 *   Jooble     POST https://jooble.org/api/{anahtar}. Ücretsiz anahtar toplam
 *              500 istekle sınırlı (ömür boyu); ürün içi kullanım ortaklık ister.
 *   Careerjet  GET https://search.api.careerjet.net/v4/query, Basic auth.
 *              Her istekte aramayı yapan gerçek kullanıcının IP'si ve
 *              tarayıcısı zorunlu (KVKK: yeni bir aktarım).
 *
 * İkisi de ilanın yalnızca kısa bir özetini veriyor; tam metin "analiz et"
 * adımında bağlantıdan çekiliyor.
 */
export interface ExternalJob {
  source: "jooble" | "careerjet"
  /** İlanın asıl yayınlandığı site (kariyer.net, linkedin.com…), biliniyorsa. */
  origin: string | null
  title: string
  company: string | null
  location: string | null
  snippet: string
  url: string
  postedAt: string | null
}

export interface JobSearchResult {
  total: number
  jobs: ExternalJob[]
}

export interface JobQuery {
  keywords: string
  location: string
}

type Fetch = typeof fetch

/** Özetlerdeki HTML etiketleri ve varlıklar düz metne iniyor. */
function plain(text: unknown): string {
  return String(text ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

const orNull = (value: unknown): string | null => {
  const text = plain(value)
  return text ? text : null
}

export interface JoobleConfig {
  apiKey: string
  /** Bölgesel anahtar başka bir alan adı isterse değiştirilebiliyor. */
  baseUrl: string
  fetch?: Fetch
}

export async function searchJooble(cfg: JoobleConfig, query: JobQuery, page = 1): Promise<JobSearchResult> {
  const response = await (cfg.fetch ?? fetch)(`${cfg.baseUrl.replace(/\/?$/, "/")}${cfg.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: query.keywords, location: query.location, page, ResultOnPage: 20 }),
  })
  if (!response.ok) throw new Error(`Jooble isteği başarısız: ${response.status}`)
  const data = (await response.json()) as { totalCount?: number; jobs?: Array<Record<string, unknown>> }
  return {
    total: data.totalCount ?? 0,
    jobs: (data.jobs ?? []).map((j) => ({
      source: "jooble" as const,
      origin: orNull(j.source),
      title: plain(j.title),
      company: orNull(j.company),
      location: orNull(j.location),
      snippet: plain(j.snippet),
      url: String(j.link ?? ""),
      postedAt: orNull(j.updated),
    })),
  }
}

export interface CareerjetConfig {
  apiKey: string
  locale: string
  fetch?: Fetch
}

/** Aramayı yapan gerçek kullanıcı; Careerjet her istekte istiyor. */
export interface Visitor {
  ip: string
  userAgent: string
}

export async function searchCareerjet(
  cfg: CareerjetConfig,
  query: JobQuery,
  visitor: Visitor,
  offset = 0,
): Promise<JobSearchResult> {
  const url = new URL("https://search.api.careerjet.net/v4/query")
  url.search = new URLSearchParams({
    locale_code: cfg.locale,
    keywords: query.keywords,
    location: query.location,
    page_size: "20",
    offset: String(offset),
    sort: "relevance",
    user_ip: visitor.ip,
    user_agent: visitor.userAgent,
  }).toString()
  const response = await (cfg.fetch ?? fetch)(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:`).toString("base64")}` },
  })
  if (!response.ok) throw new Error(`Careerjet isteği başarısız: ${response.status}`)
  const data = (await response.json()) as { type?: string; hits?: number; jobs?: Array<Record<string, unknown>> }
  // Belirsiz konumda ilan yerine konum listesi geliyor.
  if (data.type !== "JOBS") return { total: 0, jobs: [] }
  return {
    total: data.hits ?? 0,
    jobs: (data.jobs ?? []).map((j) => ({
      source: "careerjet" as const,
      origin: orNull(j.site),
      title: plain(j.title),
      company: orNull(j.company),
      location: orNull(j.locations),
      snippet: plain(j.description),
      url: String(j.url ?? ""),
      postedAt: orNull(j.date),
    })),
  }
}
