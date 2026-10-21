import "@/app/globals.css"
import type { Metadata } from "next"
import { AnalysisNotice } from "@/features/analysis/components/AnalysisNotice"
import { Navbar } from "@/components/layout/Navbar"
import { QueryProvider } from "@/components/providers/QueryProvider"
import { WebAnalytics } from "@/components/providers/WebAnalytics"
import { ThemeProvider } from "@/components/providers/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Geist } from "next/font/google"
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

// Başlık ve metin tek aile: Geist. next/font sunucudan veriyor; Google Fonts
// isteği ve düzen kayması yok.
const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: tema sınıfı istemcide <html>'e ekleniyor.
    <html lang="tr" className={geist.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <QueryProvider>
              {/* Bütün sayfaların tek üst çubuğu; giriş ekranında kendini gizliyor. */}
              <Navbar />
              {children}
              {/* Süren analizi her sayfada izleyen sağ alt bildirimi. */}
              <AnalysisNotice />
            </QueryProvider>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
        <WebAnalytics />
      </body>
    </html>
  )
}
