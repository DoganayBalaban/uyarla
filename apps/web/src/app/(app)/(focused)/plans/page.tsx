import { redirect } from "next/navigation"
import { PlansView } from "@/features/billing/components/PlansView"
import { plansFromEnv } from "@/features/billing/plans"
import { plansPath, safePlansReturn } from "@/features/billing/paywall"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"

export const metadata = { title: "Paketler · uyarla" }
export const dynamic = "force-dynamic"

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  // Açık yönlendirmeye karşı: giriş akışıyla aynı kontrol (son gözden geçirme).
  const returnTo = safePlansReturn(donus)
  // Paket hesaba bağlı: giriş yapmamış kullanıcı satır içi hata yerine girişe
  // gidiyor, sonra aynı paket ekranına dönüyor (DOG-82).
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath(returnTo ? plansPath(returnTo) : "/plans"))
  return <PlansView plans={plansFromEnv(process.env)} returnTo={returnTo} />
}
