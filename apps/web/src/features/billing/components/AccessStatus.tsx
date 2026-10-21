"use client"

import { Clock, Gift, Lock } from "lucide-react"
import Link from "next/link"
import { useBillingStatus } from "@/features/billing/api"
import { accessSummary } from "@/features/billing/format"
import { cn } from "@/lib/cn"

/**
 * Kalan haklar kutusu (DOG-81): Hesabım'da ve paket ekranında aynı metin.
 * `showCta` paket ekranının kendisinde kapalı; orada zaten paket seçiliyor.
 */
export function AccessStatus({ showCta = true, className }: { showCta?: boolean; className?: string }) {
  const { data } = useBillingStatus()
  if (!data) return <div className={cn("h-[4.5rem] rounded-card border border-border bg-card", className)} aria-hidden />
  const summary = accessSummary(data, new Date())
  const Icon = data.passEndsAt ? Clock : data.freeLeft > 0 ? Gift : Lock
  return (
    <section
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-border bg-card p-4", className)}
      aria-label="Kalan hakların"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{summary.title}</p>
        {summary.detail && <p className="mt-0.5 text-sm text-muted-foreground">{summary.detail}</p>}
      </div>
      {showCta && (
        <Link
          href="/plans"
          className="rounded-button border border-border px-4 py-2 text-sm font-semibold no-underline transition hover:border-brand-blue/40 hover:text-brand-blue"
        >
          {summary.cta}
        </Link>
      )}
    </section>
  )
}

/** Üst menüdeki kısa rozet; paket ekranına götürüyor. */
export function AccessBadge() {
  const { data } = useBillingStatus()
  if (!data) return null
  const summary = accessSummary(data, new Date())
  const live = !!data.passEndsAt || data.freeLeft > 0
  return (
    <Link
      href="/plans"
      title={summary.title}
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold no-underline transition sm:inline-flex",
        live
          ? "bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/15"
          : "border border-border text-foreground hover:border-brand-blue/40 hover:text-brand-blue",
      )}
    >
      {data.passEndsAt ? <Clock className="size-3.5" aria-hidden /> : <Gift className="size-3.5" aria-hidden />}
      {summary.badge}
    </Link>
  )
}
