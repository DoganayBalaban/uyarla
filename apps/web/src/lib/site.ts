/**
 * Sitenin herkese açık kök adresi: sitemap, robots, OG görseli ve kanonik
 * bağlantılar bunu kullanıyor. Better Auth zaten aynı adrese ihtiyaç duyduğu
 * için ayrı bir ortam değişkeni açılmadı.
 */
export function siteUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "")
}
