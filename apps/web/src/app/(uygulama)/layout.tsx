import { SayfaKabi } from "../components/Sayfa"

/**
 * Uygulama ekranlarının (analiz, uyarlama, hesap) ortak kabı. Üst çubuk kök
 * layout'ta; burada yalnızca orta genişlikte sayfa kabı var.
 *
 * Route group adrese girmiyor: /analyze, /adapt/[id], /account. Geniş
 * ekranlar (dashboard, başvuru panosu) kendi kaplarını çiziyor.
 */
export default function UygulamaLayout({ children }: { children: React.ReactNode }) {
  return <SayfaKabi genislik="orta">{children}</SayfaKabi>
}
