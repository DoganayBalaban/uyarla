"use client"

import { Check, LoaderCircle, Lock, Minus } from "lucide-react"
import { useRef, useState } from "react"
import { createCheckout, openPortal, useBillingStatus, type BillingStatus } from "@/features/billing/api"
import { AccessStatus } from "@/features/billing/components/AccessStatus"
import { PLAN_LABEL } from "@/features/billing/format"
import { FEATURE_ROWS, monthlyPrice, savingsPercent, type PlanKey, type PlanOffer } from "@/features/billing/plans"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"

type Choice = PlanKey | "free" | "manage"
type Column = { key: PlanKey | "free"; plan: PlanOffer | null }

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4 text-brand-green" aria-label="Var" />
  if (value === false) return <Minus className="mx-auto size-4 text-muted-foreground/60" aria-label="Yok" />
  return <span className="text-sm">{value}</span>
}

/** Bir sütunun düğmesi: abonelik durumu ve deneme hakkına göre. */
function action(key: PlanKey | "free", status: BillingStatus | null): { label: string; choice: Choice; current: boolean } {
  const sub = status?.access ? status.subscription : null
  if (key === "free") return { label: sub ? "Ücretsiz paket" : "Mevcut paketin", choice: "free", current: !sub }
  if (sub) return { label: "Aboneliği yönet", choice: "manage", current: sub.plan === key }
  return { label: status?.trialEligible === false ? "Abone ol" : "7 gün ücretsiz başla", choice: key, current: false }
}

const isPopular = (key: string) => key === "quarter"
/** Dar ekranda: önce 3 Ay, sonra 1 Ay, en altta Ücretsiz. */
const MOBILE_ORDER: Record<Column["key"], number> = { quarter: 0, month: 1, free: 2 }
const price = (plan: PlanOffer | null) => {
  if (!plan) return "0 ₺"
  const monthly = monthlyPrice(plan)
  return monthly === null ? "—" : `${monthly} ₺ / ay`
}
const billed = (plan: PlanOffer | null) => {
  if (!plan) return "Her zaman"
  return plan.months > 1 && plan.priceTry !== null ? `${plan.months} ayda bir ${plan.priceTry} ₺` : "Her ay"
}

/**
 * Karşılaştırma tablosu (DOG-158, spec §5). Saf: veri ve tıklama dışarıdan.
 * Masaüstünde tablo; dar ekranda paketler alt alta kart, 3 Ay en üstte.
 */
export function PlansTable({
  plans,
  status,
  busy,
  onChoose,
}: {
  plans: PlanOffer[]
  status: BillingStatus | null
  busy: Choice | null
  onChoose: (c: Choice) => void
}) {
  const saving = savingsPercent(plans)
  // Hakkı yoksa deneme vaat edilmiyor; durum yüklenmeden ilk ziyaretçi varsayılıyor.
  const trial = status?.trialEligible !== false
  const columns: Column[] = [{ key: "free", plan: null }, ...plans.map((p) => ({ key: p.key, plan: p }))]
  const name = (c: Column) => (c.plan ? PLAN_LABEL[c.plan.key] : "Ücretsiz")
  const badge = (c: Column) => (isPopular(c.key) && saving !== null ? <Badge>En popüler · %{saving} tasarruf</Badge> : null)

  const button = (key: PlanKey | "free") => {
    const a = action(key, status)
    if (a.choice === "free") return <p className="m-0 text-sm text-muted-foreground">{a.label}</p>
    return (
      <Button type="button" className="w-full" variant={isPopular(key) ? "default" : "outline"} disabled={busy !== null} onClick={() => onChoose(a.choice)}>
        {busy === a.choice && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
        {a.current ? `Mevcut paketin · ${a.label}` : a.label}
      </Button>
    )
  }

  return (
    <>
      {/* Masaüstü: tablo */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="border-b">
              <th scope="col" className="p-4 text-left text-sm font-medium text-muted-foreground">
                Özellikler
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("p-4 align-top", isPopular(c.key) && "bg-primary/5")}>
                  <div className="flex min-h-6 justify-center">{badge(c)}</div>
                  <p className="m-0 mt-2 font-semibold">{name(c)}</p>
                  <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">{price(c.plan)}</p>
                  <p className="m-0 text-xs font-normal text-muted-foreground">{billed(c.plan)}</p>
                  {c.plan && trial && <p className="m-0 mt-1 text-xs font-medium text-brand-green">7 gün ücretsiz deneme</p>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_ROWS.map((row) => (
              <tr key={row.label} className="border-b last:border-0">
                <th scope="row" className="p-3 text-left text-sm font-normal">
                  {row.label}
                </th>
                {columns.map((c) => (
                  <td key={c.key} className={cn("p-3", isPopular(c.key) && "bg-primary/5")}>
                    <Cell value={c.plan ? row.paid : row.free} />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td />
              {columns.map((c) => (
                <td key={c.key} className={cn("p-4", isPopular(c.key) && "bg-primary/5")}>
                  {button(c.key)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dar ekran: kartlar, 3 Ay en üstte */}
      <div className="grid gap-4 md:hidden">
        {[...columns]
          .sort((a, b) => MOBILE_ORDER[a.key] - MOBILE_ORDER[b.key])
          .map((c) => (
            <Card key={c.key} className={cn("gap-3 py-5 shadow-xs", isPopular(c.key) && "border-primary/50")}>
              <CardContent className="space-y-3 px-5">
                {badge(c)}
                <div>
                  <p className="m-0 font-semibold">{name(c)}</p>
                  <p className="m-0 text-2xl font-semibold tabular-nums">{price(c.plan)}</p>
                  <p className="m-0 text-xs text-muted-foreground">
                    {billed(c.plan)}
                    {c.plan && trial ? " · 7 gün ücretsiz deneme" : ""}
                  </p>
                </div>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {FEATURE_ROWS.filter((r) => (c.plan ? r.paid : r.free) !== false).map((r) => {
                    const v = c.plan ? r.paid : r.free
                    return (
                      <li key={r.label} className="flex gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
                        <span>
                          {r.label}
                          {typeof v === "string" ? ` · ${v}` : ""}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                {button(c.key)}
              </CardContent>
            </Card>
          ))}
      </div>
    </>
  )
}

/**
 * Paket ekranı (DOG-158). Cayma hakkı onayı ödeme öncesi zorunlu (Mesafeli
 * Sözleşmeler Yönetmeliği md. 15); düğme soluk durmasın diye devre dışı
 * bırakılmıyor, onaysız basılınca kutuya odaklanılıyor. Portal için onay yok.
 */
export function PlansView({ plans, returnTo }: { plans: PlanOffer[]; returnTo: string | null }) {
  const status = useBillingStatus()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<Choice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const consentRef = useRef<HTMLButtonElement>(null)

  async function choose(choice: Choice) {
    if (choice === "free") return
    setError(null)
    if (choice !== "manage" && !consent) {
      setError("Devam etmek için onay kutusunu işaretle.")
      consentRef.current?.focus()
      return
    }
    setBusy(choice)
    try {
      const { url } = choice === "manage" ? await openPortal() : await createCheckout(choice, returnTo)
      window.location.href = url
    } catch (e) {
      setError(await apiErrorMessage(e, "Ödeme sayfasını açamadık. Birazdan tekrar dener misin?"))
      setBusy(null)
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
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="text-center">
        <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Paketini seç</h1>
        <p className="mx-auto mt-2 mb-0 max-w-xl text-muted-foreground">
          Her ay 5 analiz ve 1 uyarlama ücretsiz. Abonelikte hepsi sınırsız; 7 gün ücretsiz dene, istediğin an iptal et.
        </p>
      </header>

      <AccessStatus showCta={false} className="mx-auto max-w-2xl" />

      <PlansTable plans={plans} status={status.data ?? null} busy={busy} onChoose={(c) => void choose(c)} />

      <div className="mx-auto flex max-w-2xl flex-col gap-3">
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
            Erişimin hemen (denemede deneme sonunda ücretli olarak) başlamasını ve bu nedenle cayma hakkımı kaybedeceğimi kabul
            ediyorum.{" "}
            <a href="/refund" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
              İade ve cayma koşulları
            </a>
          </span>
        </Label>
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="m-0 text-sm text-muted-foreground">
          Deneme bitmeden iptal edersen ücret alınmaz. Bitişten 3 gün önce e-postayla hatırlatırız. İstediğin an iptal edebilirsin.
        </p>
        <p className="m-0 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Ödeme Polar üzerinden alınır; kart bilgin uyarla&apos;ya gelmez. Fiyatlara KDV dahil, faturan e-postana gönderilir.
        </p>
      </div>
    </div>
  )
}
