import "./globals.css"

export const metadata = { title: "Uyarla · Sprint 1 test" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
