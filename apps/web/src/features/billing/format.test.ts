import { describe, expect, it } from "vitest"
import { PLAN_LABEL, accessSummary, adaptHint, analysisNote, formatDay, timeLeft } from "@/features/billing/format"
import type { BillingStatus } from "@/features/billing/api"

describe("billing format", () => {
  it("names the plans in Turkish", () => {
    expect(PLAN_LABEL).toEqual({ week: "1 hafta", month: "1 ay", quarter: "3 ay" })
  })

  it("formats a day in Istanbul as a Turkish date", () => {
    expect(formatDay("2026-12-10T12:00:00.000Z")).toBe("10 Aralık 2026")
    expect(formatDay("2026-11-30T21:00:00.000Z")).toBe("1 Aralık 2026")
  })

  it("says how long the pass has left", () => {
    const now = new Date("2026-12-01T12:00:00.000Z")
    expect(timeLeft("2026-12-06T12:00:00.000Z", now)).toBe("5 gün kaldı")
    // Kalan kısmi gün yukarı yuvarlanıyor: 4 gün 1 saat "5 gün".
    expect(timeLeft("2026-12-05T13:00:00.000Z", now)).toBe("5 gün kaldı")
    expect(timeLeft("2026-12-01T17:30:00.000Z", now)).toBe("6 saat kaldı")
    expect(timeLeft("2026-12-01T12:20:00.000Z", now)).toBe("1 saatten az kaldı")
  })

})

const now = new Date("2026-11-10T09:00:00Z")
const free = (over: Partial<NonNullable<BillingStatus["quota"]>> = {}): BillingStatus => ({
  access: false,
  unlimited: false,
  trialEligible: true,
  subscription: null,
  usedLast24h: 0,
  dailyCap: 30,
  quota: { analyses: { used: 3, limit: 5 }, adaptations: { used: 0, limit: 1 }, resetsAt: "2026-11-30T21:00:00.000Z", ...over },
})
const subscribed = (over: Partial<NonNullable<BillingStatus["subscription"]>> = {}): BillingStatus => ({
  access: true,
  unlimited: false,
  trialEligible: false,
  quota: null,
  usedLast24h: 0,
  dailyCap: 30,
  subscription: {
    plan: "quarter",
    status: "active",
    currentPeriodEnd: "2027-01-28T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    trialEnd: null,
    createdAt: "2026-10-28T00:00:00.000Z",
    priceTry: 599,
    ...over,
  },
})

describe("accessSummary (DOG-158)", () => {
  it("free: this month's quota and when it renews", () => {
    expect(accessSummary(free(), now)).toMatchObject({
      title: "Bu ay 2 analiz ve 1 uyarlama hakkın kaldı",
      detail: "1 Aralık 2026 tarihinde yenilenir.",
      badge: "Ücretsiz",
      cta: "Paketleri gör",
    })
  })
  it("trial: days left and what will be charged, or that nothing will be", () => {
    const trial = subscribed({ status: "trialing", trialEnd: "2026-11-15T09:00:00.000Z" })
    expect(accessSummary(trial, now)).toMatchObject({ title: "Denemedesin · 5 gün kaldı", detail: "15 Kasım 2026 tarihinde 599 ₺ çekilecek.", badge: "Deneme · 5 gün" })
    expect(accessSummary(subscribed({ status: "trialing", trialEnd: "2026-11-15T09:00:00.000Z", cancelAtPeriodEnd: true }), now).detail).toBe(
      "Deneme 15 Kasım 2026 tarihinde bitiyor; ücret çekilmeyecek.",
    )
  })
  it("active, cancelled and payment failed", () => {
    expect(accessSummary(subscribed(), now)).toMatchObject({ title: "3 Ay aboneliğin açık", detail: "Sonraki ödeme 28 Ocak 2027 · 599 ₺", badge: "Abone", cta: "Aboneliği yönet" })
    expect(accessSummary(subscribed({ cancelAtPeriodEnd: true }), now).detail).toBe("İptal ettin; erişimin 28 Ocak 2027 tarihine kadar açık.")
    expect(accessSummary(subscribed({ status: "past_due" }), now)).toMatchObject({ title: "Ödemen alınamadı", badge: "Ödeme bekliyor" })
  })
  it("admin: unlimited", () => {
    expect(accessSummary({ ...free(), unlimited: true }, now).title).toBe("Yönetici hesabı: her şey sınırsız")
  })
})

describe("adaptHint, analysisNote (DOG-158)", () => {
  it("free user sees what the next action spends", () => {
    expect(adaptHint(free())).toBe("Bu uyarlama bu ayki ücretsiz hakkını kullanır.")
    expect(adaptHint(free({ adaptations: { used: 1, limit: 1 } }))).toBe("Bu ayki ücretsiz uyarlamanı kullandın; devam etmek için abonelik gerekiyor.")
    expect(analysisNote(free())).toBe("Bu ay 3/5 analiz · 1 Aralık 2026 tarihinde yenilenir")
  })
  it("subscriber sees only the daily cap; admin sees nothing", () => {
    expect(adaptHint(subscribed())).toBeNull()
    expect(adaptHint({ ...subscribed(), usedLast24h: 30 })).toBe("Son 24 saatteki 30 uyarlama sınırına ulaştın.")
    expect(analysisNote(subscribed())).toBeNull()
    expect(adaptHint({ ...free({ adaptations: { used: 1, limit: 1 } }), unlimited: true })).toBeNull()
  })
})
