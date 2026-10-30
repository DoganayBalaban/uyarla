import { Navbar } from "@/components/layout/Navbar"
import { AppShell } from "@/components/layout/app-shell/AppShell"
import { getSession } from "@/server/authz"

/**
 * KVKK, kullanım koşulları ve iade sayfalarının kabı. Kayıtlı kullanıcı
 * uygulamadaki kenar çubuğunu görüyor (paket ekranından ya da hesap
 * menüsünden geliyor); ziyaretçi ve Polar incelemesi tanıtımın üst çubuğunu.
 */
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (session && !session.user.isAnonymous) return <AppShell>{children}</AppShell>
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
