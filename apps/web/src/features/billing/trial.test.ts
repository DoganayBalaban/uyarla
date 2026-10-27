import { describe, expect, it } from "vitest"
import { trialBanner } from "@/features/billing/trial"
import type { BillingStatus } from "@/features/billing/api"

const status = (over: Partial<NonNullable<BillingStatus["subscription"]>> = {}): BillingStatus => ({
  access: true,
  unlimited: false,
  trialEligible: false,
  quota: null,
  usedLast24h: 0,
  dailyCap: 30,
  subscription: {
    plan: "quarter",
    status: "trialing",
    currentPeriodEnd: "2026-11-03T09:00:00.000Z",
    cancelAtPeriodEnd: false,
    trialEnd: "2026-11-03T09:00:00.000Z",
    createdAt: "2026-10-27T09:00:00.000Z",
    priceTry: 599,
    ...over,
  },
})

describe("trialBanner (DOG-158)", () => {
  it("days left and the charge, urgent in the last two days", () => {
    expect(trialBanner(status(), new Date("2026-10-29T09:00:00Z"))).toEqual({ text: "Deneme: 5 gün kaldı · 3 Kasım 2026 tarihinde 599 ₺ çekilecek", urgent: false })
    expect(trialBanner(status(), new Date("2026-11-02T09:00:00Z"))?.urgent).toBe(true)
  })

  it("says nothing will be charged after a cancel; nothing for non-trials", () => {
    expect(trialBanner(status({ cancelAtPeriodEnd: true }), new Date("2026-10-29T09:00:00Z"))?.text).toBe("Deneme 3 Kasım 2026 tarihinde bitiyor; ücret çekilmeyecek")
    expect(trialBanner(status({ status: "active", trialEnd: null }), new Date("2026-10-29T09:00:00Z"))).toBeNull()
  })
})
