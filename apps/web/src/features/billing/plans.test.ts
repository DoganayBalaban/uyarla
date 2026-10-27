import { describe, expect, it } from "vitest"
import { FEATURE_ROWS, monthlyPrice, plansFromEnv, savingsPercent } from "@/features/billing/plans"

const env = { POLAR_PRODUCT_MONTH: "prod_m", POLAR_PRODUCT_QUARTER: "prod_q", POLAR_PRODUCT_WEEK: "prod_w", PLAN_PRICES_TRY: "month:299, quarter:599" }

describe("plans (DOG-158)", () => {
  it("offers only the subscription plans that have a product", () => {
    expect(plansFromEnv(env).map((p) => [p.key, p.months, p.priceTry])).toEqual([
      ["month", 1, 299],
      ["quarter", 3, 599],
    ])
    expect(plansFromEnv({ POLAR_PRODUCT_QUARTER: "prod_q" }).map((p) => p.key)).toEqual(["quarter"])
  })

  it("shows the quarter as 200 ₺ a month and 33% cheaper", () => {
    const [month, quarter] = plansFromEnv(env)
    expect(monthlyPrice(month!)).toBe(299)
    expect(monthlyPrice(quarter!)).toBe(200)
    expect(savingsPercent(plansFromEnv(env))).toBe(33)
    expect(savingsPercent(plansFromEnv({ POLAR_PRODUCT_QUARTER: "prod_q", PLAN_PRICES_TRY: "quarter:599" }))).toBeNull()
  })

  it("lists the free limits and what the subscription opens", () => {
    expect(FEATURE_ROWS.find((r) => r.label.startsWith("İlan analizi"))).toEqual({ label: "İlan analizi ve uyum skoru", free: "Ayda 5", paid: "Sınırsız" })
    expect(FEATURE_ROWS.find((r) => r.label === "Mülakat hazırlık paketi")).toEqual({ label: "Mülakat hazırlık paketi", free: false, paid: true })
  })
})
