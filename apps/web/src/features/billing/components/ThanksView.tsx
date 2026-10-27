"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useBillingStatus } from "@/features/billing/api"
import { GIVE_UP_AFTER_MS, SLOW_AFTER_MS, paymentArrived, pollInterval } from "@/features/billing/thanks"
import { LEGAL } from "@/features/legal/company"
import { CircleCheck, Clock, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Ödemeden sonra: bildirim birkaç saniye gecikebilir; dönem açılınca kullanıcı
 * işine dönüyor.
 *
 * `since`: ödeme oturumunun açıldığı an (DOG-80). Önceden aktif bir dönemi
 * olan kullanıcıda eski bitiş tarihi "erişimin açıldı" diye gösteriliyordu;
 * artık yalnızca bu andan sonra açılan dönem bekleniyor. Ödeme hiç gelmezse
 * yoklama on dakikada duruyor.
 */
export function ThanksView({ returnTo, since }: { returnTo: string | null; since: number | null }) {
  const router = useRouter()
  const status = useBillingStatus({ poll: pollInterval, until: (s) => paymentArrived(s, since) })
  const [elapsed, setElapsed] = useState<"fresh" | "slow" | "gaveUp">("fresh")
  const arrived = status.data ? paymentArrived(status.data, since) : false

  useEffect(() => {
    const slow = setTimeout(() => setElapsed("slow"), SLOW_AFTER_MS)
    const gaveUp = setTimeout(() => setElapsed("gaveUp"), GIVE_UP_AFTER_MS)
    return () => {
      clearTimeout(slow)
      clearTimeout(gaveUp)
    }
  }, [])

  useEffect(() => {
    if (arrived && returnTo) router.replace(returnTo)
  }, [arrived, returnTo, router])

  if (arrived && status.data?.subscription) {
    const trial = status.data.subscription.status === "trialing"
    return (
      <Card className="mx-auto max-w-md items-center py-10 text-center">
        <CardContent className="flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-full bg-brand-green/10 text-brand-green dark:text-[#4ade80]">
            <CircleCheck className="size-6" aria-hidden />
          </span>
          <h1 className="m-0 mt-4 text-xl font-semibold">{trial ? "Denemen başladı" : "Aboneliğin başladı"}</h1>
          <p className="m-0 mt-2 text-sm text-muted-foreground">
            {trial
              ? "7 gün boyunca her şey açık. Deneme bitmeden iptal edersen ücret çekilmez."
              : "Analiz, uyarlama ve hazırlık araçları açık."}
          </p>
          {!returnTo && (
            <Button asChild className="mt-6">
              <Link href="/analyze">Yeni analiz</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="mx-auto max-w-md items-center py-10 text-center">
      <CardContent className="flex flex-col items-center">
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          {elapsed === "gaveUp" ? <Clock className="size-6" aria-hidden /> : <LoaderCircle className="size-6 motion-safe:animate-spin" aria-hidden />}
        </span>
        <h1 className="m-0 mt-4 text-xl font-semibold">{elapsed === "gaveUp" ? "Ödemen henüz görünmüyor" : "Ödemen alınıyor…"}</h1>
        <p className="m-0 mt-2 text-sm text-muted-foreground">
          {elapsed === "gaveUp"
            ? `Ödemen alındıysa erişimin kısa süre içinde açılır; sayfayı yenileyerek bakabilirsin. Açılmazsa ${LEGAL.support} adresine yaz.`
            : elapsed === "slow"
              ? `Ödemen alındıysa erişimin birkaç dakika içinde açılır. Açılmazsa ${LEGAL.support} adresine yaz.`
              : "Birkaç saniye sürebilir, sayfadan ayrılma."}
        </p>
      </CardContent>
    </Card>
  )
}
