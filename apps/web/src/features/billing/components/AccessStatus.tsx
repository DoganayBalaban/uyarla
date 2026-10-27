"use client"

import { Clock, Gift, Lock } from "lucide-react"
import Link from "next/link"
import { useBillingStatus } from "@/features/billing/api"
import { accessSummary } from "@/features/billing/format"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"

/**
 * Kalan haklar kutusu (DOG-81): Hesabım'da ve paket ekranında aynı metin.
 * `showCta` paket ekranının kendisinde kapalı; orada zaten paket seçiliyor.
 */
export function AccessStatus({ showCta = true, className }: { showCta?: boolean; className?: string }) {
  const { data } = useBillingStatus()
  if (!data) return <div className={cn("h-[4.5rem] rounded-xl border bg-card", className)} aria-hidden />
  const summary = accessSummary(data, new Date())
  const Icon = data.access ? Clock : data.quota && data.quota.adaptations.used < data.quota.adaptations.limit ? Gift : Lock
  return (
    <section
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card p-4 shadow-xs", className)}
      aria-label="Kalan hakların"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-semibold">{summary.title}</p>
        {summary.detail && <p className="m-0 mt-0.5 text-sm text-muted-foreground">{summary.detail}</p>}
      </div>
      {showCta && (
        <Button asChild variant="outline">
          <Link href="/plans">{summary.cta}</Link>
        </Button>
      )}
    </section>
  )
}

/** Üst menüdeki kısa rozet; paket ekranına götürüyor. */
export function AccessBadge() {
  const { data } = useBillingStatus()
  if (!data) return null
  const summary = accessSummary(data, new Date())
  const live = data.access || (data.quota ? data.quota.analyses.used < data.quota.analyses.limit : false)
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
      {data.access ? <Clock className="size-3.5" aria-hidden /> : <Gift className="size-3.5" aria-hidden />}
      {summary.badge}
    </Link>
  )
}
