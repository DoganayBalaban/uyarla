import { ThanksView } from "@/features/billing/components/ThanksView"
import { safePlansReturn } from "@/features/billing/paywall"

export const metadata = { title: "Teşekkürler · uyarla" }

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  // Açık yönlendirmeye karşı: giriş akışıyla aynı kontrol (son gözden geçirme).
  const returnTo = safePlansReturn(donus)
  return <ThanksView returnTo={returnTo} />
}
