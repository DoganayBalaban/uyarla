"use client"

import { Check, LoaderCircle, Lock } from "lucide-react"
import { useRef, useState } from "react"
import { createCheckout } from "@/features/billing/api"
import { AccessStatus } from "@/features/billing/components/AccessStatus"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/cn"
import { PLAN_LABEL } from "@/features/billing/format"
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
  const consentRef = useRef<HTMLButtonElement>(null)
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
      <Card className="mx-auto max-w-xl items-center py-10 text-center">
        <CardContent>
          <h1 className="m-0 text-xl font-semibold">Paketler şu an kapalı</h1>
          <p className="m-0 mt-2 text-sm text-muted-foreground">
            Birazdan tekrar dener misin? Sorun sürerse iletisim@uyarla.com.tr adresine yaz.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="text-center">
        <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Erişim dönemini seç</h1>
        <p className="mx-auto mt-2 mb-0 max-w-xl text-muted-foreground">
          Süre boyunca istediğin kadar CV uyarla ve ön yazı oluştur. Tek seferlik ödeme, otomatik yenileme yok.
        </p>
      </header>

      <AccessStatus showCta={false} className="mx-auto mt-6 max-w-2xl" />

      <RadioGroup
        value={selected ?? ""}
        onValueChange={(v) => setSelected(v as PlanKey)}
        aria-label="Paket"
        className="mt-8 grid gap-4 sm:grid-cols-3"
      >
        {plans.map((p) => {
          const isRecommended = recommended?.key === p.key
          const isCheapest = cheapest?.key === p.key && cheapest.key !== recommended?.key
          return (
            <Label
              key={p.key}
              htmlFor={`paket-${p.key}`}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-xl border bg-card p-5 font-normal shadow-xs transition",
                "hover:border-primary/40 has-data-[state=checked]:border-primary has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-primary/20",
                isRecommended && "bg-gradient-to-b from-primary/5 to-card",
              )}
            >
              {isRecommended && <Badge className="absolute -top-2.5 left-5">Önerilen</Badge>}
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground">{PLAN_LABEL[p.key]}</span>
                <RadioGroupItem id={`paket-${p.key}`} value={p.key} />
              </span>
              <span className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {p.priceTry !== null ? `${p.priceTry} TL` : "—"}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                {p.days} gün erişim
              </span>
              {isCheapest && <span className="mt-3 text-xs font-semibold text-brand-green">Günlük en uygun</span>}
            </Label>
          )
        })}
      </RadioGroup>

      <Card className="mt-6 py-0 shadow-xs">
        <CardContent className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_minmax(0,22rem)]">
          <div>
            <p className="m-0 text-sm font-semibold">Her pakette</p>
            <ul className="m-0 mt-3 list-none space-y-2 p-0">
              {PASS_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="flex items-start gap-2.5 text-sm font-normal leading-snug">
              <Checkbox
                ref={consentRef}
                checked={consent}
                onCheckedChange={(v) => {
                  setConsent(v === true)
                  if (v === true) setError(null)
                }}
                aria-invalid={error && !consent ? true : undefined}
                className="mt-0.5"
              />
              <span>
                Erişimin hemen başlamasını ve bu nedenle cayma hakkımı kaybedeceğimi kabul ediyorum.{" "}
                <a href="/refund" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
                  İade ve cayma koşulları
                </a>
              </span>
            </Label>
            <Button type="button" size="lg" className="w-full" disabled={busy || !plan} onClick={() => void pay()}>
              {busy && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
              {busy ? "Ödeme sayfası açılıyor…" : plan ? `${PLAN_LABEL[plan.key]}${plan.priceTry !== null ? ` · ${plan.priceTry} TL` : ""}` : "Paket seç"}
            </Button>
            {error && (
              <p role="alert" className="m-0 text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="m-0 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Ödeme Polar üzerinden alınır; kart bilgin uyarla&apos;ya gelmez. Fiyatlara KDV dahil, faturan e-postana gönderilir.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
