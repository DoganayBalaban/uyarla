import { describe, expect, it } from "vitest"
import { PLAN_LABEL, formatPassEnd, perDay, plansIntro } from "@/features/billing/format"

describe("billing format", () => {
  it("names the plans in Turkish", () => {
    expect(PLAN_LABEL).toEqual({ week: "1 hafta", month: "1 ay", quarter: "3 ay" })
  })

  it("formats the pass end as a Turkish date", () => {
    expect(formatPassEnd("2026-12-10T12:00:00.000Z")).toBe("10 Aralık 2026")
  })

  it("shows the price per day for comparison", () => {
    expect(perDay(349, 30)).toBe("11,63 TL/gün")
    expect(perDay(null, 30)).toBeNull()
  })

  it("introduces the plans according to what the user has", () => {
    // Ücretsiz hakkı duran kullanıcıya "kullandın" denmiyordu (yerel deneme).
    expect(plansIntro({ passEndsAt: null, freeUsed: false })).toContain("Bir ücretsiz uyarlama hakkın var")
    expect(plansIntro({ passEndsAt: null, freeUsed: true })).toContain("Ücretsiz uyarlama hakkını kullandın")
    expect(plansIntro({ passEndsAt: "2026-12-10T12:00:00.000Z", freeUsed: true })).toContain("10 Aralık 2026 tarihine kadar açık")
  })
})

