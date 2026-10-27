"use client"

import { useState } from "react"
import { openPortal, useBillingStatus } from "@/features/billing/api"
import { trialBanner } from "@/features/billing/trial"
import { cn } from "@/lib/cn"

/** Denemedeki kullanıcıya her sayfada (DOG-158): ne zaman ne çekilecek, "Yönet". */
export function TrialBanner() {
  const { data } = useBillingStatus()
  const [busy, setBusy] = useState(false)
  const banner = data ? trialBanner(data, new Date()) : null
  if (!banner) return null
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-center text-sm",
        banner.urgent ? "bg-brand-amber/15 font-medium" : "bg-primary/5",
      )}
    >
      <span>{banner.text}</span>
      <button
        type="button"
        disabled={busy}
        className="font-medium text-primary underline underline-offset-2 disabled:opacity-60"
        onClick={() => {
          setBusy(true)
          void openPortal()
            .then(({ url }) => {
              window.location.href = url
            })
            .catch(() => setBusy(false))
        }}
      >
        Yönet
      </button>
    </div>
  )
}
