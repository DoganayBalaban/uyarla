import type { ReactNode } from "react"
import { PLAN_LABEL } from "@/features/billing/format"
import type { PlanOffer } from "@/features/billing/plans"
import { cn } from "@/lib/cn"

/**
 * Bir paketin kartı (DOG-82). Paket ekranında seçilebilir, ana sayfada
 * bağlantı olarak kullanılıyor (DOG-84); içerik iki yerde aynı kalsın diye
 * yalnız görünüm burada.
 */
export function PlanCardBody({
  plan,
  recommended,
  cheapest,
  selected = false,
  footer,
}: {
  plan: PlanOffer
  recommended: boolean
  cheapest: boolean
  selected?: boolean
  /** Kartın altı; ana sayfada "Paketi seç". */
  footer?: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-card border bg-card p-5 transition",
        selected ? "border-brand-blue ring-2 ring-brand-blue/25" : "border-border",
      )}
    >
      {recommended && (
        <span className="absolute -top-3 left-5 rounded-full bg-brand-blue px-2.5 py-0.5 text-xs font-semibold text-white">
          Önerilen
        </span>
      )}
      <p className="text-sm font-semibold text-muted-foreground">{PLAN_LABEL[plan.key]}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">
        {plan.priceTry !== null ? `${plan.priceTry} TL` : "—"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {plan.days} gün erişim
      </p>
      {cheapest && <p className="mt-3 text-xs font-semibold text-brand-green">Günlük en uygun</p>}
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </div>
  )
}
