"use client"

import Link from "next/link"
import { useBillingStatus } from "@/features/billing/api"
import { formatPassEnd } from "@/features/billing/format"

/** Hesabım'da erişim dönemi. */
export function PassSection() {
  const { data } = useBillingStatus()
  if (!data) return null
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <h2 className="text-lg">Erişim dönemi</h2>
      <p className="mt-1 text-sm text-muted">
        {data.passEndsAt
          ? `${formatPassEnd(data.passEndsAt)} tarihine kadar açık.`
          : data.freeUsed
            ? "Ücretsiz uyarlama hakkını kullandın."
            : "Bir ücretsiz uyarlama hakkın var."}
      </p>
      <Link href="/plans" className="mt-3 inline-block text-sm font-semibold">
        {data.passEndsAt ? "Süreyi uzat" : "Paket al"}
      </Link>
    </section>
  )
}
