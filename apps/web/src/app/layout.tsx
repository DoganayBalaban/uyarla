import "./globals.css"
import type { Metadata } from "next"
import { AnalizBildirimi } from "./components/AnalizBildirimi"
import { Navbar } from "./components/Navbar"
import { siteAdresi } from "@/lib/site"

const BASLIK = "uyarla · Her ilana, doğru CV."
const ACIKLAMA =
  "İlanı yapıştır, CV'nin ne kadar uyduğunu gör ve tek tıkla ilana özel hâle getir. Deneyimini uydurmadan."

// Görsel app/opengraph-image.tsx'ten, ikon app/icon.svg'den kendiliğinden
// ekleniyor; metadataBase onların tam adresini üretiyor.
export const metadata: Metadata = {
  metadataBase: new URL(siteAdresi()),
  title: BASLIK,
  description: ACIKLAMA,
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "uyarla",
    title: BASLIK,
    description: ACIKLAMA,
  },
  twitter: { card: "summary_large_image", title: BASLIK, description: ACIKLAMA },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        {/* Başlık ve metin tek aile: Geist. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Bütün sayfaların tek üst çubuğu; giriş ekranında kendini gizliyor. */}
        <Navbar />
        {children}
        {/* Süren analizi her sayfada izleyen sağ alt bildirimi. */}
        <AnalizBildirimi />
      </body>
    </html>
  )
}
