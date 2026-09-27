import { OturumCubugu } from "../components/OturumCubugu"

/**
 * Uygulama ekranlarının (analiz, uyarlama, hesap) ortak çerçevesi: yapışık
 * üst çubuk ve ortalanmış içerik. Zeminin üstünde marka mavisinden çok hafif
 * bir ışıma var; içerik kartları beyaz (koyu temada kart rengi) kalıyor.
 *
 * Route group adrese girmiyor: /analyze, /adapt/[id], /account. Giriş
 * ekranı (/login) ve pano (/applications) kendi yerleşimleriyle çiziliyor.
 */
export default function UygulamaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-zemin">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(43_78_255/0.08),transparent)]"
      />
      <OturumCubugu />
      <main className="relative mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-6 sm:pt-10">{children}</main>
    </div>
  )
}
