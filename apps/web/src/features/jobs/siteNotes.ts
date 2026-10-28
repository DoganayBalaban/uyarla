import type { SearchSite } from "@uyarla/core/jobSuggest/links"

/** Her sitenin ne aradığı; bağlantı kurallarıyla aynı (jobSuggest/links). */
export const SITE_NOTE: Record<SearchSite, (city: string | null) => string> = {
  kariyernet: () => "Şehri sitede seçersin",
  linkedin: (city) => (city ? `${city}, Türkiye` : "Tüm Türkiye"),
  jooble: (city) => city ?? "Tüm Türkiye",
  careerjet: (city) => city ?? "Tüm Türkiye",
}
