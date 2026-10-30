import { Navbar } from "@/components/layout/Navbar"

/**
 * Tanıtım sayfalarının kabı: eski üst çubuk burada (DOG-144). Uygulama
 * ekranları kenar çubuğu kabuğunda; yasal sayfalar (legal) grubunda.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
