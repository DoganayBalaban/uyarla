import { describe, expect, it } from "vitest"
import { GIVE_UP_AFTER_MS, parseSince, paymentArrived, pollInterval } from "@/features/billing/thanks"

import type { BillingStatus } from "@/features/billing/api"

const since = Date.parse("2026-10-28T10:00:00Z")
const arrived = (createdAt: string, access = true): BillingStatus => ({
  access,
  unlimited: false,
  trialEligible: false,
  quota: null,
  usedLast24h: 0,
  dailyCap: 30,
  subscription: { plan: "month", status: "trialing", currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: "2026-11-04T00:00:00.000Z", createdAt, priceTry: 299 },
})

describe("paymentArrived (DOG-158)", () => {
  it("waits for a subscription opened after the checkout started", () => {
    expect(paymentArrived(arrived("2026-10-28T10:00:03Z"), since)).toBe(true)
    // Bildirim oturum zamanından birkaç saniye önce yazılmış olabilir (saat farkı).
    expect(paymentArrived(arrived("2026-10-28T09:59:58Z"), since)).toBe(true)
    expect(paymentArrived(arrived("2026-09-01T00:00:00Z"), since)).toBe(false)
    expect(paymentArrived(arrived("2026-10-28T10:00:03Z", false), since)).toBe(false)
  })
  it("old links without a timestamp take any open subscription", () => {
    expect(paymentArrived(arrived("2026-09-01T00:00:00Z"), null)).toBe(true)
    expect(paymentArrived({ ...arrived("2026-09-01T00:00:00Z"), subscription: null }, null)).toBe(false)
  })
})

describe("pollInterval", () => {
  it("polls fast, then slowly, then stops", () => {
    expect(pollInterval(0)).toBe(2_000)
    expect(pollInterval(90_000)).toBe(10_000)
    expect(pollInterval(GIVE_UP_AFTER_MS)).toBe(false)
  })
})

describe("parseSince", () => {
  it("reads a millisecond timestamp and rejects anything else", () => {
    expect(parseSince(String(since))).toBe(since)
    expect(parseSince("abc")).toBeNull()
    expect(parseSince(undefined)).toBeNull()
  })
})
