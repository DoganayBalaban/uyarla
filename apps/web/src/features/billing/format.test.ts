import { describe, expect, it } from "vitest"
import { PLAN_LABEL, accessSummary, adaptHint, formatPassEnd, payLabel, perDay, stackNote, timeLeft } from "@/features/billing/format"
import type { BillingStatus } from "@/features/billing/api"

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

  it("labels the pay button with the plan and its price", () => {
    expect(payLabel({ key: "month", days: 30, productId: "p", priceTry: 349 })).toBe("1 ay · 349 TL öde")
    expect(payLabel({ key: "week", days: 7, productId: "p", priceTry: null })).toBe("1 hafta öde")
  })

  it("says how long the pass has left", () => {
    const now = new Date("2026-12-01T12:00:00.000Z")
    expect(timeLeft("2026-12-06T12:00:00.000Z", now)).toBe("5 gün kaldı")
    // Kalan kısmi gün yukarı yuvarlanıyor: 4 gün 1 saat "5 gün".
    expect(timeLeft("2026-12-05T13:00:00.000Z", now)).toBe("5 gün kaldı")
    expect(timeLeft("2026-12-01T17:30:00.000Z", now)).toBe("6 saat kaldı")
    expect(timeLeft("2026-12-01T12:20:00.000Z", now)).toBe("1 saatten az kaldı")
  })

  describe("accessSummary", () => {
    const now = new Date("2026-12-01T12:00:00.000Z")
    const base: BillingStatus = { passEndsAt: null, freeUsed: false, freeLeft: 1, usedLast24h: 0, dailyCap: 30 }

    it("offers the free adaptation first", () => {
      expect(accessSummary(base, now)).toEqual({
        title: "1 ücretsiz uyarlama hakkın var",
        detail: "Skor her zaman ücretsiz. Daha fazla uyarlama için bir paket seçebilirsin.",
        badge: "1 ücretsiz hak",
        cta: "Paketleri gör",
      })
    })

    it("tells a user without rights that a pass is needed", () => {
      expect(accessSummary({ ...base, freeUsed: true, freeLeft: 0 }, now)).toMatchObject({
        title: "Ücretsiz uyarlama hakkını kullandın",
        badge: "Paket al",
        cta: "Paket al",
      })
    })

    it("shows the end, the time left and the daily allowance during a pass", () => {
      expect(accessSummary({ ...base, freeUsed: true, freeLeft: 0, passEndsAt: "2026-12-06T12:00:00.000Z", usedLast24h: 12 }, now)).toEqual({
        title: "Erişimin 6 Aralık 2026 tarihine kadar açık",
        detail: "5 gün kaldı · Son 24 saatte 18 uyarlama hakkın kaldı (sınır 30).",
        badge: "5 gün kaldı",
        cta: "Süreyi uzat",
      })
    })

    it("explains the rolling window when the daily cap is reached", () => {
      const summary = accessSummary({ ...base, passEndsAt: "2026-12-06T12:00:00.000Z", usedLast24h: 30 }, now)
      expect(summary.detail).toContain("sınırına ulaştın")
      // Pencere kayan 24 saat: "yarın" yanıltıcı (DOG-80).
      expect(summary.detail).not.toContain("yarın")
    })
  })

  it("says a new pass starts when the current one ends", () => {
    const base: BillingStatus = { passEndsAt: null, freeUsed: true, freeLeft: 0, usedLast24h: 0, dailyCap: 30 }
    expect(stackNote(base)).toBeNull()
    expect(stackNote({ ...base, passEndsAt: "2026-12-06T12:00:00.000Z" })).toBe(
      "Yeni paket, mevcut erişimin bittiğinde (6 Aralık 2026) başlar; süreler üst üste eklenir.",
    )
  })

  describe("adaptHint", () => {
    const base: BillingStatus = { passEndsAt: null, freeUsed: false, freeLeft: 1, usedLast24h: 0, dailyCap: 30 }

    it("warns that the free right will be used", () => {
      expect(adaptHint(base)).toBe("Bu uyarlama ücretsiz hakkını kullanır.")
    })

    it("warns that a pass is needed when no right is left", () => {
      expect(adaptHint({ ...base, freeUsed: true, freeLeft: 0 })).toBe("Ücretsiz hakkını kullandın; uyarlamak için bir paket gerekiyor.")
    })

    it("stays quiet during a pass with room left", () => {
      expect(adaptHint({ ...base, passEndsAt: "2026-12-06T12:00:00.000Z", usedLast24h: 3 })).toBeNull()
    })
  })
})
