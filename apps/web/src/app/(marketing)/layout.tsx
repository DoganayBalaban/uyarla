import { Navbar } from "@/components/layout/Navbar"

/**
 * Tanıtım ve yasal sayfaların kabı: eski üst çubuk yalnızca burada (DOG-144).
 * Uygulama ekranları kenar çubuğu kabuğunda.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
