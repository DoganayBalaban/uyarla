import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PlansTable } from "@/features/billing/components/PlansView"
import type { BillingStatus } from "@/features/billing/api"

const plans = [
  { key: "month" as const, months: 1, productId: "prod_m", priceTry: 299 },
  { key: "quarter" as const, months: 3, productId: "prod_q", priceTry: 599 },
]
const free: BillingStatus = {
  access: false,
  unlimited: false,
  trialEligible: true,
  subscription: null,
  quota: { analyses: { used: 0, limit: 5 }, adaptations: { used: 0, limit: 1 }, resetsAt: "2026-11-30T21:00:00.000Z" },
  usedLast24h: 0,
  dailyCap: 30,
}
const render = (status: BillingStatus | null) => renderToStaticMarkup(<PlansTable plans={plans} status={status} busy={null} onChoose={() => {}} />)
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("PlansTable (DOG-158)", () => {
  it("compares Free, 1 Ay and 3 Ay with monthly prices and the quarter's saving", () => {
    const t = text(render(free))
    expect(t).toContain("Ücretsiz")
    expect(t).toContain("299 ₺ / ay")
    expect(t).toContain("200 ₺ / ay")
    expect(t).toContain("3 ayda bir 599 ₺")
    expect(t).toContain("En popüler · %33 tasarruf")
    expect(t).toContain("Ayda 5")
  })

  it("offers the trial only to someone who never subscribed", () => {
    expect(text(render(free))).toContain("7 gün ücretsiz başla")
    expect(text(render({ ...free, trialEligible: false }))).not.toContain("7 gün ücretsiz başla")
    expect(text(render({ ...free, trialEligible: false }))).toContain("Abone ol")
    // Deneme hakkı olmayana sütun başlığında da deneme vaat edilmesin (son inceleme).
    expect(text(render({ ...free, trialEligible: false }))).not.toContain("7 gün ücretsiz deneme")
  })

  it("marks the subscriber's own plan and offers to manage it", () => {
    const sub: BillingStatus = {
      ...free,
      access: true,
      trialEligible: false,
      quota: null,
      subscription: { plan: "quarter", status: "active", currentPeriodEnd: "2027-01-28T00:00:00.000Z", cancelAtPeriodEnd: false, trialEnd: null, createdAt: "2026-10-28T00:00:00.000Z", priceTry: 599 },
    }
    const t = text(render(sub))
    expect(t).toContain("Mevcut paketin")
    expect(t).toContain("Aboneliği yönet")
  })
})
