import { ThanksView } from "@/features/billing/components/ThanksView"
import { safePlansReturn } from "@/features/billing/paywall"
import { parseSince } from "@/features/billing/thanks"

export const metadata = { title: "Teşekkürler · uyarla" }

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ donus?: string; odeme?: string }> }) {
  const { donus, odeme } = await searchParams
  // Açık yönlendirmeye karşı: giriş akışıyla aynı kontrol (son gözden geçirme).
  const returnTo = safePlansReturn(donus)
  // Ödeme oturumunun açıldığı an (DOG-80); eski bağlantılarda yok.
  return <ThanksView returnTo={returnTo} since={parseSince(odeme)} />
}
