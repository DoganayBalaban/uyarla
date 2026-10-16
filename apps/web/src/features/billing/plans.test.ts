import { describe, expect, it } from "vitest"
import { cheapestPerDay, isPlanKey, plansFromEnv, recommendedPlan } from "@/features/billing/plans"

describe("plansFromEnv", () => {
  it("lists only the plans with a product id, with display prices", () => {
    expect(
      plansFromEnv({
        POLAR_PRODUCT_WEEK: "prod_w",
        POLAR_PRODUCT_MONTH: "prod_m",
        POLAR_PRODUCT_QUARTER: "",
        PLAN_PRICES_TRY: "week:149, month:349, quarter:799",
      }),
    ).toEqual([
      { key: "week", days: 7, productId: "prod_w", priceTry: 149 },
      { key: "month", days: 30, productId: "prod_m", priceTry: 349 },
    ])
  })

  it("leaves the price empty when it is not configured", () => {
    expect(plansFromEnv({ POLAR_PRODUCT_MONTH: "prod_m" })).toEqual([{ key: "month", days: 30, productId: "prod_m", priceTry: null }])
  })
})

describe("isPlanKey", () => {
  it("accepts only known plans", () => {
    expect(isPlanKey("month")).toBe(true)
    expect(isPlanKey("year")).toBe(false)
    expect(isPlanKey(undefined)).toBe(false)
  })
})

describe("plan picks", () => {
  const offer = (key: "week" | "month" | "quarter", days: number, priceTry: number | null) => ({ key, days, productId: `p_${key}`, priceTry })
  const all = [offer("week", 7, 149), offer("month", 30, 349), offer("quarter", 90, 799)]

  it("recommends the month pass and falls back to the first offer", () => {
    expect(recommendedPlan(all)?.key).toBe("month")
    expect(recommendedPlan([all[0]!, all[2]!])?.key).toBe("week")
    expect(recommendedPlan([])).toBeNull()
  })

  it("finds the cheapest plan per day, ignoring plans without a price", () => {
    expect(cheapestPerDay(all)?.key).toBe("quarter")
    expect(cheapestPerDay([offer("week", 7, 149), offer("quarter", 90, null)])?.key).toBe("week")
  })
})
