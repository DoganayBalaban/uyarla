import { redirect } from "next/navigation"
import { prisma } from "@uyarla/db"
import { OnboardingFlow } from "@/features/onboarding/components/OnboardingFlow"
import { onboardingGate } from "@/features/onboarding/gate"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

export const dynamic = "force-dynamic"
export const metadata = { title: "Hesabını kur · uyarla" }

/**
 * Onboarding kapısı (spec §3). Giriş dönüşü her zaman buradan geçiyor;
 * bitirmiş ya da anonim kullanıcı ekranı hiç görmeden hedefe gidiyor.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ donus?: string | string[] }>
}) {
  const { donus } = await searchParams
  const session = await getSession()
  const profile = session && !session.user.isAnonymous ? await getProfile(prisma, session.user.id) : null
  const decision = onboardingGate({
    session: session ? { isAnonymous: session.user.isAnonymous } : null,
    onboardedAt: profile?.onboardedAt ?? null,
    donus: Array.isArray(donus) ? donus[0] : donus,
  })
  if (decision.kind !== "show") redirect(decision.to)
  return <OnboardingFlow initialName={profile?.name ?? ""} returnTo={decision.returnTo} />
}
