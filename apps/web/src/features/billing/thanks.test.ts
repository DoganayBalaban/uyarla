import { describe, expect, it } from "vitest"
import { GIVE_UP_AFTER_MS, parseSince, paymentArrived, pollInterval } from "@/features/billing/thanks"

const status = (passEndsAt: string | null, lastPassAt: string | null) => ({
  passEndsAt,
  lastPassAt,
  freeUsed: true,
  freeLeft: 0,
  usedLast24h: 0,
  dailyCap: 30,
})
const since = Date.parse("2026-10-19T12:00:00Z")

describe("paymentArrived", () => {
  it("does not take an older active pass for the new payment", () => {
    expect(paymentArrived(status("2026-10-25T00:00:00Z", "2026-10-18T09:00:00Z"), since)).toBe(false)
  })

  it("sees a pass opened after the checkout, also when the webhook came first", () => {
    expect(paymentArrived(status("2026-11-01T00:00:00Z", "2026-10-19T12:00:20Z"), since)).toBe(true)
  })

  it("waits while there is no pass and falls back to any pass for old links", () => {
    expect(paymentArrived(status(null, null), since)).toBe(false)
    expect(paymentArrived(status("2026-10-25T00:00:00Z", "2026-10-18T09:00:00Z"), null)).toBe(true)
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
