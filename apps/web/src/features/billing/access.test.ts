import { describe, expect, it } from "vitest"
import { activePassEnd, canAdapt, extendPass, type PassLike } from "@/features/billing/access"

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
