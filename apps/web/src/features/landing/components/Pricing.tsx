import { ArrowRight, Check, Lock } from "lucide-react"
import Link from "next/link"
import { PlanCardBody } from "@/features/billing/components/PlanCard"
import { PASS_FEATURES, cheapestPerDay, recommendedPlan, type PlanOffer } from "@/features/billing/plans"
import s from "@/features/landing/landing.module.css"

/**
 * Tanıtım sayfasında fiyatlandırma (DOG-84). Paketler paket ekranıyla aynı
 * kaynaktan (`plansFromEnv`) ve aynı kartla; fiyat iki yerde ayrı yazılmıyor.
 * Ton "şeffaf, baskısız" (marka rehberi §6.2): ücretsiz kısım önde.
 */
export function Pricing({ plans }: { plans: PlanOffer[] }) {
  if (plans.length === 0) return null
  const recommended = recommendedPlan(plans)
  const cheapest = cheapestPerDay(plans)
  return (
    <section id="fiyat" className={s.section}>
      <div className={s.container}>
        <div className={s.sectionHeader}>
          <span className={s.sectionLabel}>Fiyat</span>
          <h2 className={s.h2}>Skor ücretsiz. Uyarlama için tek seferlik paket.</h2>
          <p className={s.sectionLead}>
            İlk uyarlaman da ücretsiz. Daha fazlası için bir erişim dönemi seç; otomatik yenileme yok.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <div className="flex h-full flex-col rounded-card border border-border bg-card p-5">
            <p className="text-sm font-semibold text-muted-foreground">Ücretsiz</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">0 TL</p>
            <p className="mt-1 text-sm text-muted-foreground">Sınırsız skor · 1 uyarlama</p>
            <div className="mt-auto pt-4">
              <Link
                href="/analyze"
                className="inline-flex w-full justify-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold no-underline transition hover:border-brand-blue/40 hover:text-brand-blue"
              >
                Ücretsiz skorumu gör
              </Link>
            </div>
          </div>
          {plans.map((plan) => (
            <Link
              key={plan.key}
              href="/plans"
              className="block rounded-card text-inherit no-underline transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              <PlanCardBody
                plan={plan}
                recommended={recommended?.key === plan.key}
                cheapest={cheapest?.key === plan.key && cheapest.key !== recommended?.key}
                footer={
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue">
                    Paketi seç <ArrowRight className="size-4" aria-hidden />
                  </span>
                }
              />
            </Link>
          ))}
        </div>

        <div className="mx-auto mt-6 flex max-w-5xl flex-col gap-4 rounded-card border border-border bg-card p-5 sm:p-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold">Her pakette</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-x-8">
              {PASS_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex max-w-xs items-start gap-1.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Tek seferlik ödeme, fiyatlara KDV dahil. Ödeme Polar üzerinden; kart bilgin bize gelmez.{" "}
              <Link href="/refund" className="font-medium !text-brand-blue underline underline-offset-2">
                İade ve cayma
              </Link>
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
