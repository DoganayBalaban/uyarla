import { describe, expect, it } from "vitest"
import { DAILY_CAP, accessSnapshot, activePassEnd, canAdapt, extendPass, hasLivePass, type PassLike } from "@/features/billing/access"

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

describe("extendPass", () => {
  it("starts now when there is no active pass", () => {
    expect(extendPass([], "week", NOW)).toEqual({ startsAt: NOW, endsAt: new Date(NOW.getTime() + 7 * day) })
  })

  it("stacks on top of the latest active end", () => {
    const end = new Date(NOW.getTime() + 4 * day)
    expect(extendPass([pass(-3, 4)], "month", NOW)).toEqual({ startsAt: end, endsAt: new Date(end.getTime() + 30 * day) })
  })

  it("does not stack on an expired or refunded pass", () => {
    expect(extendPass([pass(-10, -1), pass(-1, 9, "refunded")], "quarter", NOW).startsAt).toEqual(NOW)
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
