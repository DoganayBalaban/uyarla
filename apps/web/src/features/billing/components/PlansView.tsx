"use client"

import { Check, LoaderCircle, Lock } from "lucide-react"
import { useRef, useState } from "react"
import { createCheckout, useBillingStatus } from "@/features/billing/api"
import { AccessStatus } from "@/features/billing/components/AccessStatus"
import { PlanCardBody } from "@/features/billing/components/PlanCard"
import { payLabel, stackNote } from "@/features/billing/format"
import { PASS_FEATURES, cheapestPerDay, recommendedPlan, type PlanKey, type PlanOffer } from "@/features/billing/plans"
import { apiErrorMessage } from "@/lib/api"

/**
 * Paket ekranı (DOG-34, yeniden tasarım DOG-82). Önce paket seçiliyor, sonra
 * tek bir ödeme düğmesi: marka rehberi §9.5 "birincil eylem her ekranda tek".
 * Ödeme Polar'ın sayfasında. Cayma hakkı onayı ödeme öncesi zorunlu (Mesafeli
 * Sözleşmeler Yönetmeliği md. 15); düğme soluk durmasın diye devre dışı
 * bırakılmıyor, onaysız basılınca kutu işaretleniyor.
 */
export function PlansView({ plans, returnTo }: { plans: PlanOffer[]; returnTo: string | null }) {
  const [selected, setSelected] = useState<PlanKey | null>(recommendedPlan(plans)?.key ?? null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const consentRef = useRef<HTMLInputElement>(null)
  const status = useBillingStatus()
  const note = status.data ? stackNote(status.data) : null
  const recommended = recommendedPlan(plans)
  const cheapest = cheapestPerDay(plans)
  const plan = plans.find((p) => p.key === selected) ?? null

  async function pay() {
    if (!plan) return
    if (!consent) {
      setError("Devam etmek için onay kutusunu işaretle.")
      consentRef.current?.focus()
      return
    }
    setError(null)
    setBusy(true)
    try {
      const { url } = await createCheckout(plan.key, returnTo)
      window.location.href = url
    } catch (e) {
      setError(await apiErrorMessage(e, "Ödeme sayfasını açamadık. Birazdan tekrar dener misin?"))
      setBusy(false)
    }
  }

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-2xl">Paketler şu an kapalı</h1>
        <p className="mt-2 text-muted-foreground">Birazdan tekrar dener misin? Sorun sürerse iletisim@uyarla.com.tr adresine yaz.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="text-center">
        <h1 className="text-2xl sm:text-3xl">Erişim dönemini seç</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Süre boyunca istediğin kadar CV uyarla ve ön yazı oluştur. Tek seferlik ödeme, otomatik yenileme yok.
        </p>
      </header>

      <AccessStatus showCta={false} className="mx-auto mt-6 max-w-2xl" />

      <fieldset className="mt-8">
        <legend className="sr-only">Paket</legend>
        <div className="grid gap-6 sm:grid-cols-3 sm:gap-4">
          {plans.map((p) => (
            <label key={p.key} className="block cursor-pointer">
              <input
                type="radio"
                name="plan"
                value={p.key}
                checked={selected === p.key}
                onChange={() => setSelected(p.key)}
                className="peer sr-only"
              />
              <div className="h-full rounded-card peer-focus-visible:ring-2 peer-focus-visible:ring-brand-blue peer-focus-visible:ring-offset-2">
                <PlanCardBody
                  plan={p}
                  recommended={recommended?.key === p.key}
                  cheapest={cheapest?.key === p.key && cheapest.key !== recommended?.key}
                  selected={selected === p.key}
                />
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-6 rounded-card border border-border bg-card p-5 sm:p-6 md:grid-cols-[1fr_minmax(0,22rem)]">
        <div>
          <p className="text-sm font-semibold">Her pakette</p>
          <ul className="mt-3 space-y-2">
            {PASS_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          {note && <p className="rounded-button bg-brand-blue/5 px-3 py-2 text-sm">{note}</p>}
          <label className="flex items-start gap-2.5 text-sm">
            <input
              ref={consentRef}
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked)
                if (e.target.checked) setError(null)
              }}
              className="mt-0.5 size-4 shrink-0 accent-brand-blue"
            />
            <span>
              Erişimin hemen başlamasını ve bu nedenle cayma hakkımı kaybedeceğimi kabul ediyorum.{" "}
              <a href="/refund" target="_blank" rel="noreferrer" className="font-medium text-brand-blue underline underline-offset-2">
                İade ve cayma koşulları
              </a>
            </span>
          </label>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-brand-blue px-5 py-3 font-semibold text-white shadow-sm shadow-brand-blue/30 transition hover:bg-brand-blue/90 disabled:cursor-wait disabled:opacity-70"
            disabled={busy || !plan}
            onClick={() => void pay()}
          >
            {busy && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
            {busy
              ? "Ödeme sayfası açılıyor…"
              : plan
                ? payLabel(plan)
                : "Paket seç"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-brand-red">
              {error}
            </p>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Ödeme Polar üzerinden alınır; kart bilgin uyarla&apos;ya gelmez. Fiyatlara KDV dahil, faturan e-postana gönderilir.
          </p>
        </div>
      </div>
    </div>
  )
}
