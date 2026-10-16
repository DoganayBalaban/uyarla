"use client"

import { useState } from "react"
import { createCheckout, useBillingStatus } from "@/features/billing/api"
import { PLAN_LABEL, perDay, plansIntro } from "@/features/billing/format"
import type { PlanOffer } from "@/features/billing/plans"
import { apiErrorMessage } from "@/lib/api"

/**
 * Paket ekranı (DOG-34). Ödeme Polar'ın sayfasında; buradan oraya gidiliyor.
 * Cayma hakkı onayı ödeme öncesi zorunlu (Mesafeli Sözleşmeler Yönetmeliği md. 15).
 */
export function PlansView({ plans, returnTo }: { plans: PlanOffer[]; returnTo: string | null }) {
  const status = useBillingStatus()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const best = plans.reduce<PlanOffer | null>(
    (b, p) => (p.priceTry !== null && (!b || (b.priceTry ?? Infinity) / b.days > p.priceTry / p.days) ? p : b),
    null,
  )

  async function buy(plan: PlanOffer) {
    setError(null)
    setBusy(plan.key)
    try {
      const { url } = await createCheckout(plan.key, returnTo)
      window.location.href = url
    } catch (e) {
      setError(await apiErrorMessage(e, "Ödeme sayfasını açamadık. Birazdan tekrar dener misin?"))
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl sm:text-3xl">Uyarlamaya devam et</h1>
      <p className="mt-2 text-muted">
        {plansIntro(status.data)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.key} className="rounded-card border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-muted">{PLAN_LABEL[plan.key]}</p>
            <p className="mt-1 text-3xl font-bold">{plan.priceTry !== null ? `${plan.priceTry} TL` : "—"}</p>
            <p className="text-xs text-muted">{perDay(plan.priceTry, plan.days)}</p>
            {best?.key === plan.key && <p className="mt-2 text-xs font-semibold text-brand-green">En iyi birim fiyat</p>}
            <button
              type="button"
              className="mt-4 w-full rounded-button bg-brand-blue px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              disabled={!consent || busy !== null}
              onClick={() => void buy(plan)}
            >
              {busy === plan.key ? "Yönlendiriliyor…" : "Öde"}
            </button>
          </div>
        ))}
      </div>

      <label className="mt-6 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          Erişimin hemen başlamasını ve bu nedenle cayma hakkımı kaybedeceğimi kabul ediyorum.{" "}
          <a href="/refund" target="_blank" rel="noreferrer">
            İade ve cayma koşulları
          </a>
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-red">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs text-muted">
        Ödeme Polar üzerinden alınır; kart bilgin uyarla&apos;ya gelmez. Faturan e-postana gönderilir.
      </p>
    </div>
  )
}
