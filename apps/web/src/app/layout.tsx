import "@/app/globals.css"
import type { Metadata } from "next"
import { AnalysisNotice } from "@/features/analysis/components/AnalysisNotice"
import { Navbar } from "@/components/layout/Navbar"
import { siteUrl } from "@/lib/site"

const TITLE = "uyarla · Her ilana, doğru CV."
const DESCRIPTION =
  "İlanı yapıştır, CV'nin ne kadar uyduğunu gör ve tek tıkla ilana özel hâle getir. Deneyimini uydurmadan."

// Görsel app/opengraph-image.tsx'ten, ikon app/icon.svg'den kendiliğinden
// ekleniyor; metadataBase onların tam adresini üretiyor.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "uyarla",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
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
        <AnalysisNotice />
      </body>
    </html>
  )
}
