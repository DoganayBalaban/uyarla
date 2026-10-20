/**
 * Panodaki "İlan bul" kartı (DOG-68): profile göre hazır arama bağlantıları.
 * API çağrısı, kazıma ya da ilan saklama yok; yalnızca sitelerin kendi arama
 * sayfaları yeni sekmede açılıyor.
 *
 * Biçimler 20 Ekim 2026'da tarayıcıda denendi:
 *   Jooble     tr.jooble.org/SearchResult?ukw=…&rgns=…   (800 sonuç)
 *   Careerjet  careerjet.com.tr/arama/isler?s=…&l=…      (77 sonuç)
 *   Kariyer.net kariyer.net/is-ilanlari?kw=…             (şehir yolu doğrulanamadı,
 *              site bot korumasına takıldı; şehir sitede seçiliyor)
 *   LinkedIn   linkedin.com/jobs/search/?keywords=…&location=…
 *              Konum "İstanbul, Türkiye" biçiminde olmalı; yalnızca "İstanbul"
 *              ABD sonuçlarına düşüyordu.
 */
export type SearchSite = "kariyernet" | "linkedin" | "jooble" | "careerjet"

export interface SearchLink {
  site: SearchSite
  label: string
  url: string
}

export function searchLinks(query: { keywords: string; city?: string | null }): SearchLink[] {
  const keywords = query.keywords.trim()
  if (!keywords) return []
  const city = query.city?.trim() || null
  const q = (params: Record<string, string | null>) =>
    Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&")
  return [
    { site: "kariyernet", label: "Kariyer.net", url: `https://www.kariyer.net/is-ilanlari?${q({ kw: keywords })}` },
    {
      site: "linkedin",
      label: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?${q({ keywords, location: city ? `${city}, Türkiye` : "Türkiye" })}`,
    },
    { site: "jooble", label: "Jooble", url: `https://tr.jooble.org/SearchResult?${q({ ukw: keywords, rgns: city })}` },
    { site: "careerjet", label: "Careerjet", url: `https://www.careerjet.com.tr/arama/isler?${q({ s: keywords, l: city })}` },
  ]
}
