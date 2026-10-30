import { cookies } from "next/headers"
import { prisma } from "@uyarla/db"
import { AppShell } from "@/components/layout/app-shell/AppShell"
import { PageActionsProvider } from "@/components/layout/app-shell/PageActions"
import { VisitorHeader } from "@/components/layout/app-shell/VisitorHeader"
import { OnboardingRedirect } from "@/features/onboarding/components/OnboardingRedirect"
import { ONBOARDING_DEFERRED_COOKIE, shouldRedirectToOnboarding } from "@/features/onboarding/gate"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

/**
 * Uygulama ekranlarının ortak kabı: kenar çubuğu, üst çubuk ve içerik
 * (DOG-144, AppShell).
 *
 * Onboarding'i görmemiş kayıtlı kullanıcı bir kez yönlendiriliyor (spec §3).
 * Anonim kullanıcı için sorgu atılmıyor; ona yalnızca logolu bir üst çubuk
 * çiziliyor (VisitorHeader).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const profile = session && !session.user.isAnonymous ? await getProfile(prisma, session.user.id) : null
  const cookieStore = await cookies()
  const deferred = cookieStore.has(ONBOARDING_DEFERRED_COOKIE)
  const redirectToOnboarding = shouldRedirectToOnboarding(
    session ? { isAnonymous: session.user.isAnonymous, onboardedAt: profile?.onboardedAt ?? null } : null,
    deferred,
  )
  // Kayıtsız ziyaretçi (anonim oturum dahil) kabuğu görmüyor: açabildiği tek
  // iş analiz, kilitli menü ögeleri ilk denemeyi dağıtıyordu.
  if (!session || session.user.isAnonymous) {
    return (
      <PageActionsProvider>
        <div className="min-h-dvh bg-background">
          <VisitorHeader />
          {children}
        </div>
      </PageActionsProvider>
    )
  }
  return <AppShell before={redirectToOnboarding && <OnboardingRedirect />}>{children}</AppShell>
}
