"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useBillingStatus } from "@/features/billing/api"
import { formatPassEnd } from "@/features/billing/format"
import { LEGAL } from "@/features/legal/company"

/** Ödemeden sonra: bildirim birkaç saniye gecikebilir; dönem açılınca kullanıcı işine dönüyor. */
export function ThanksView({ returnTo }: { returnTo: string | null }) {
  const router = useRouter()
  const status = useBillingStatus({ pollMs: 2000 })
  const [waitedLong, setWaitedLong] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setWaitedLong(true), 60_000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (status.data?.passEndsAt && returnTo) router.replace(returnTo)
  }, [status.data?.passEndsAt, returnTo, router])

  if (status.data?.passEndsAt) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl">Erişimin açıldı</h1>
        <p className="mt-2 text-muted">{formatPassEnd(status.data.passEndsAt)} tarihine kadar istediğin kadar uyarlayabilirsin.</p>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl">Ödemen alınıyor…</h1>
      <p className="mt-2 text-muted">
        {waitedLong
          ? `Ödemen alındıysa erişimin birkaç dakika içinde açılır. Açılmazsa ${LEGAL.support} adresine yaz.`
          : "Birkaç saniye sürebilir, sayfadan ayrılma."}
      </p>
    </div>
  )
}
