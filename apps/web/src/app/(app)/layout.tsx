import { cookies } from "next/headers"
import { prisma } from "@uyarla/db"
import { OnboardingRedirect } from "@/features/onboarding/components/OnboardingRedirect"
import { ONBOARDING_DEFERRED_COOKIE, shouldRedirectToOnboarding } from "@/features/onboarding/gate"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

/**
 * Uygulama ekranlarının ortak kabı: onboarding'i görmemiş kayıtlı kullanıcı
 * bir kez yönlendiriliyor (spec §3). Anonim kullanıcı için sorgu atılmıyor.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const profile = session && !session.user.isAnonymous ? await getProfile(prisma, session.user.id) : null
  const deferred = (await cookies()).has(ONBOARDING_DEFERRED_COOKIE)
  const redirectToOnboarding = shouldRedirectToOnboarding(
    session ? { isAnonymous: session.user.isAnonymous, onboardedAt: profile?.onboardedAt ?? null } : null,
    deferred,
  )
  return (
    <>
      {redirectToOnboarding && <OnboardingRedirect />}
      {children}
    </>
  )
}
