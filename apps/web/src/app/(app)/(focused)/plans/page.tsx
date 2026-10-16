import { PlansView } from "@/features/billing/components/PlansView"
import { plansFromEnv } from "@/features/billing/plans"
import { safePlansReturn } from "@/features/billing/paywall"

export const metadata = { title: "Paketler · uyarla" }
export const dynamic = "force-dynamic"

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  // Açık yönlendirmeye karşı: giriş akışıyla aynı kontrol (son gözden geçirme).
  const returnTo = safePlansReturn(donus)
  return <PlansView plans={plansFromEnv(process.env)} returnTo={returnTo} />
}
