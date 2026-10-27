"use client"

import { Lock } from "lucide-react"
import Link from "next/link"
import { useBillingStatus, type BillingStatus } from "@/features/billing/api"
import { plansPath } from "@/features/billing/paywall"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"

/** Durum yüklenirken kilit gösterilmiyor; sunucu yine 402 ile koruyor. */
export function isLocked(status: BillingStatus | undefined): boolean {
  return !!status && !status.access && !status.unlimited
}

/**
 * Abonelikteki özellik (DOG-158, spec §5): gizlenmiyor; ne açtığı tek cümleyle
 * ve deneme düğmesiyle görünüyor.
 */
export function LockedFeatureCard({
  title,
  description,
  returnTo,
  trial,
  compact = false,
}: {
  title: string
  description: string
  returnTo: string
  trial: boolean
  compact?: boolean
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-muted/30", compact ? "p-3" : "p-5")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Lock className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-medium">{title}</p>
        <p className="m-0 text-sm text-muted-foreground">{description}</p>
      </div>
      <Button asChild size={compact ? "sm" : "default"}>
        <Link href={plansPath(returnTo)}>{trial ? "7 gün ücretsiz dene" : "Abone ol"}</Link>
      </Button>
    </div>
  )
}

export function LockedFeature(props: { title: string; description: string; returnTo: string; compact?: boolean }) {
  const { data } = useBillingStatus()
  return <LockedFeatureCard {...props} trial={data?.trialEligible !== false} />
}
