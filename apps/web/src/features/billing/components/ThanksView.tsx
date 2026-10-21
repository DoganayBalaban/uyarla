"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useBillingStatus } from "@/features/billing/api"
import { formatPassEnd } from "@/features/billing/format"
import { GIVE_UP_AFTER_MS, SLOW_AFTER_MS, paymentArrived, pollInterval } from "@/features/billing/thanks"
import { LEGAL } from "@/features/legal/company"

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

  if (arrived && status.data?.passEndsAt) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl">Erişimin açıldı</h1>
        <p className="mt-2 text-muted-foreground">{formatPassEnd(status.data.passEndsAt)} tarihine kadar istediğin kadar uyarlayabilirsin.</p>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl">{elapsed === "gaveUp" ? "Ödemen henüz görünmüyor" : "Ödemen alınıyor…"}</h1>
      <p className="mt-2 text-muted-foreground">
        {elapsed === "gaveUp"
          ? `Ödemen alındıysa erişimin kısa süre içinde açılır; sayfayı yenileyerek bakabilirsin. Açılmazsa ${LEGAL.support} adresine yaz.`
          : elapsed === "slow"
            ? `Ödemen alındıysa erişimin birkaç dakika içinde açılır. Açılmazsa ${LEGAL.support} adresine yaz.`
            : "Birkaç saniye sürebilir, sayfadan ayrılma."}
      </p>
    </div>
  )
}
