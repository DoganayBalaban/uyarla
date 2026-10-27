import { describe, expect, it } from "vitest"
import { DAILY_CAP, FREE_QUOTA, accessSnapshot, activePassEnd, canAdapt, currentSubscription, decide, grantsAccess, hasAccess, hasLivePass, monthStart, nextMonthStart, trialEligible, type PassLike, type SubscriptionLike, type Usage } from "@/features/billing/access"

const NOW = new Date("2026-11-10T12:00:00Z")
const day = 864e5
const pass = (startOffsetDays: number, endOffsetDays: number, status: PassLike["status"] = "active"): PassLike => ({
  status,
  startsAt: new Date(NOW.getTime() + startOffsetDays * day),
  endsAt: new Date(NOW.getTime() + endOffsetDays * day),
})

describe("canAdapt", () => {
  it("allows the first adaptation for free", () => {
    expect(canAdapt({ adaptationsUsed: 0, adaptationsLast24h: 0, passes: [], now: NOW })).toEqual({ allowed: true, via: "free" })
  })

  it("asks for payment after the free adaptation", () => {
    expect(canAdapt({ adaptationsUsed: 1, adaptationsLast24h: 1, passes: [], now: NOW })).toEqual({
      allowed: false,
      reason: "payment_required",
    })
  })

  it("allows with an active pass", () => {
    expect(canAdapt({ adaptationsUsed: 5, adaptationsLast24h: 2, passes: [pass(-3, 4)], now: NOW })).toEqual({
      allowed: true,
      via: "pass",
    })
  })

  it("ignores expired and refunded passes", () => {
    const passes = [pass(-10, -1), pass(-2, 5, "refunded")]
    expect(canAdapt({ adaptationsUsed: 1, adaptationsLast24h: 0, passes, now: NOW }).allowed).toBe(false)
  })

  it("treats the end instant as expired", () => {
    expect(canAdapt({ adaptationsUsed: 1, adaptationsLast24h: 0, passes: [pass(-7, 0)], now: NOW }).allowed).toBe(false)
  })

  it("caps a pass at 30 adaptations in the last 24 hours", () => {
    // Review Focus 5: 30. geçer, 31. daily_cap.
    expect(canAdapt({ adaptationsUsed: 40, adaptationsLast24h: 29, passes: [pass(-1, 6)], now: NOW }).allowed).toBe(true)
    expect(canAdapt({ adaptationsUsed: 40, adaptationsLast24h: 30, passes: [pass(-1, 6)], now: NOW })).toEqual({
      allowed: false,
      reason: "daily_cap",
    })
  })
})

describe("activePassEnd", () => {
  it("is the latest end among active passes", () => {
    expect(activePassEnd([pass(-1, 3), pass(3, 33)], NOW)).toEqual(new Date(NOW.getTime() + 33 * day))
    expect(activePassEnd([pass(-10, -1)], NOW)).toBeNull()
  })
})

describe("accessSnapshot", () => {
  it("reports the free right left when nothing is used", () => {
    expect(accessSnapshot({ adaptationsUsed: 0, adaptationsLast24h: 0, passes: [], now: NOW })).toEqual({
      passEndsAt: null,
      freeLeft: 1,
      usedLast24h: 0,
      dailyCap: DAILY_CAP,
    })
  })

  it("never reports a negative free right", () => {
    expect(accessSnapshot({ adaptationsUsed: 4, adaptationsLast24h: 0, passes: [], now: NOW }).freeLeft).toBe(0)
  })

  it("reports the pass end and the last 24 hours during a pass", () => {
    const snap = accessSnapshot({ adaptationsUsed: 9, adaptationsLast24h: 12, passes: [pass(-1, 6)], now: NOW })
    expect(snap.passEndsAt).toEqual(new Date(NOW.getTime() + 6 * day))
    expect(snap.usedLast24h).toBe(12)
  })
})

describe("canAdapt · admin", () => {
  it("lets an admin adapt with no free right, no pass and past the daily cap", () => {
    expect(
      canAdapt({ adaptationsUsed: 50, adaptationsLast24h: DAILY_CAP + 5, passes: [], now: new Date(), unlimited: true }),
    ).toEqual({ allowed: true, via: "admin" })
  })
})

describe("hasLivePass", () => {
  const now = new Date("2026-10-22T12:00:00Z")
  it("only a pass active right now counts", () => {
    expect(hasLivePass([{ status: "active", startsAt: new Date("2026-10-20"), endsAt: new Date("2026-10-27") }], now)).toBe(true)
    expect(hasLivePass([{ status: "active", startsAt: new Date("2026-10-25"), endsAt: new Date("2026-11-01") }], now)).toBe(false)
    expect(hasLivePass([{ status: "refunded", startsAt: new Date("2026-10-20"), endsAt: new Date("2026-10-27") }], now)).toBe(false)
  })
})

const at = (iso: string) => new Date(iso)
const sub = (over: Partial<SubscriptionLike> = {}): SubscriptionLike => ({
  status: "active",
  currentPeriodEnd: at("2026-11-28T00:00:00Z"),
  cancelAtPeriodEnd: false,
  trialEnd: null,
  endedAt: null,
  createdAt: at("2026-10-28T00:00:00Z"),
  ...over,
})
const subNow = at("2026-11-10T12:00:00Z")
const usage = (over: Partial<Usage> = {}): Usage => ({ analysesThisMonth: 0, adaptationsThisMonth: 0, adaptationsLast24h: 0, ...over })

describe("grantsAccess (DOG-158)", () => {
  it("opens for trialing and active", () => {
    expect(grantsAccess(sub({ status: "trialing", trialEnd: at("2026-11-12T00:00:00Z") }), subNow)).toBe(true)
    expect(grantsAccess(sub(), subNow)).toBe(true)
  })
  it("keeps a cancelled-at-period-end subscription open until the period ends", () => {
    expect(grantsAccess(sub({ cancelAtPeriodEnd: true }), subNow)).toBe(true)
    expect(grantsAccess(sub({ status: "canceled", cancelAtPeriodEnd: true }), subNow)).toBe(true)
    expect(grantsAccess(sub({ status: "canceled", currentPeriodEnd: at("2026-11-01T00:00:00Z") }), subNow)).toBe(false)
  })
  it("closes at once when refunded or revoked (endedAt in the past)", () => {
    expect(grantsAccess(sub({ status: "canceled", endedAt: at("2026-11-09T00:00:00Z") }), subNow)).toBe(false)
    expect(grantsAccess(sub({ status: "active", endedAt: at("2026-11-09T00:00:00Z") }), subNow)).toBe(false)
  })
  it("keeps past_due open until the period end; unknown and unpaid are closed", () => {
    expect(grantsAccess(sub({ status: "past_due" }), subNow)).toBe(true)
    expect(grantsAccess(sub({ status: "past_due", currentPeriodEnd: at("2026-11-01T00:00:00Z") }), subNow)).toBe(false)
    expect(grantsAccess(sub({ status: "unpaid" }), subNow)).toBe(false)
    expect(grantsAccess(sub({ status: "incomplete" }), subNow)).toBe(false)
    expect(grantsAccess(sub({ status: "yeni-bir-durum" }), subNow)).toBe(false)
  })
})

describe("hasAccess, currentSubscription, trialEligible", () => {
  it("any row granting access is enough; the open one is current, else the newest", () => {
    const old = sub({ status: "canceled", endedAt: at("2026-10-30T00:00:00Z"), createdAt: at("2026-10-01T00:00:00Z") })
    const live = sub({ createdAt: at("2026-11-01T00:00:00Z") })
    expect(hasAccess([old, live], subNow)).toBe(true)
    expect(currentSubscription([old, live], subNow)).toBe(live)
    expect(currentSubscription([old], subNow)).toBe(old)
    expect(currentSubscription([], subNow)).toBeNull()
  })
  it("trial only for someone who never had a subscription", () => {
    expect(trialEligible([])).toBe(true)
    expect(trialEligible([sub({ status: "canceled", endedAt: at("2026-10-30T00:00:00Z") })])).toBe(false)
  })
})

describe("monthStart (İstanbul, UTC+3)", () => {
  it("counts 31 Oct 23:30 Istanbul in October and 1 Nov 00:10 Istanbul in November", () => {
    expect(monthStart(at("2026-10-31T20:30:00Z")).toISOString()).toBe("2026-09-30T21:00:00.000Z")
    expect(monthStart(at("2026-10-31T21:10:00Z")).toISOString()).toBe("2026-10-31T21:00:00.000Z")
  })
  it("next month start across the year end", () => {
    expect(nextMonthStart(at("2026-12-15T10:00:00Z")).toISOString()).toBe("2026-12-31T21:00:00.000Z")
  })
})

describe("decide (DOG-158)", () => {
  it("free: 5 analyses and 1 adaptation a month", () => {
    expect(decide("analysis", { subs: [], usage: usage({ analysesThisMonth: FREE_QUOTA.analyses - 1 }), now: subNow })).toEqual({ allowed: true, via: "free" })
    expect(decide("analysis", { subs: [], usage: usage({ analysesThisMonth: FREE_QUOTA.analyses }), now: subNow })).toEqual({ allowed: false, code: "analysis_quota" })
    expect(decide("adaptation", { subs: [], usage: usage(), now: subNow })).toEqual({ allowed: true, via: "free" })
    expect(decide("adaptation", { subs: [], usage: usage({ adaptationsThisMonth: 1 }), now: subNow })).toEqual({ allowed: false, code: "adaptation_quota" })
  })
  it("free: subscription-only features are closed", () => {
    for (const f of ["interview_prep", "practice", "form_answer", "linkedin_rewrite"] as const) {
      expect(decide(f, { subs: [], usage: usage(), now: subNow })).toEqual({ allowed: false, code: "subscription_required" })
    }
  })
  it("subscriber: no monthly quota, daily cap on adaptations", () => {
    const subs = [sub({ status: "trialing", trialEnd: at("2026-11-12T00:00:00Z") })]
    expect(decide("analysis", { subs, usage: usage({ analysesThisMonth: 50 }), now: subNow })).toEqual({ allowed: true, via: "subscription" })
    expect(decide("adaptation", { subs, usage: usage({ adaptationsThisMonth: 9, adaptationsLast24h: DAILY_CAP - 1 }), now: subNow })).toEqual({ allowed: true, via: "subscription" })
    expect(decide("adaptation", { subs, usage: usage({ adaptationsLast24h: DAILY_CAP }), now: subNow })).toEqual({ allowed: false, code: "daily_cap" })
    expect(decide("practice", { subs, usage: usage(), now: subNow })).toEqual({ allowed: true, via: "subscription" })
  })
  it("admin: everything, no cap", () => {
    expect(decide("adaptation", { subs: [], usage: usage({ adaptationsLast24h: 99, adaptationsThisMonth: 99 }), now: subNow, unlimited: true })).toEqual({ allowed: true, via: "admin" })
  })
})
