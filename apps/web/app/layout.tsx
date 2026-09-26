import "./globals.css"
import { UstCubuk } from "./components/UstCubuk"

export const metadata = {
  title: "uyarla",
  description: "Her ilana, doğru CV.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        {/* Marka rehberi §9.2: başlık Manrope, metin Inter. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <UstCubuk />
        {children}
      </body>
    </html>
  )
}
