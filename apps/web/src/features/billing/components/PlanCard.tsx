import type { ReactNode } from "react"
import { PLAN_LABEL } from "@/features/billing/format"
import { monthlyPrice, type PlanOffer } from "@/features/billing/plans"
import { cn } from "@/lib/cn"

/**
 * Bir aboneliğin kartı (DOG-84, DOG-158): tanıtım sayfasında bağlantı olarak.
 * Fiyat aylık karşılığıyla; 3 Ay'da fatura tutarı ve tasarruf ayrıca.
 */
export function PlanCardBody({
  plan,
  popular,
  saving,
  footer,
}: {
  plan: PlanOffer
  popular: boolean
  /** 3 Ay'ın 1 Ay'a göre tasarrufu, yüzde. */
  saving: number | null
  footer?: ReactNode
}) {
  const monthly = monthlyPrice(plan)
  return (
    <div className={cn("relative flex h-full flex-col rounded-card border bg-card p-5 transition", popular ? "border-brand-blue ring-2 ring-brand-blue/25" : "border-border")}>
      {popular && (
        <span className="absolute -top-3 left-5 rounded-full bg-brand-blue px-2.5 py-0.5 text-xs font-semibold text-white">
          En popüler{saving !== null ? ` · %${saving} tasarruf` : ""}
        </span>
      )}
      <p className="text-sm font-semibold text-muted-foreground">{PLAN_LABEL[plan.key]}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{monthly !== null ? `${monthly} ₺` : "—"}<span className="text-base font-medium text-muted-foreground"> / ay</span></p>
      <p className="mt-1 text-sm text-muted-foreground">
        {plan.months > 1 && plan.priceTry !== null ? `${plan.months} ayda bir ${plan.priceTry} ₺` : "Her ay"}
      </p>
      <p className="mt-3 text-xs font-semibold text-brand-green">7 gün ücretsiz deneme</p>
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </div>
  )
}
