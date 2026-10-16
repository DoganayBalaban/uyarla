import { describe, expect, it } from "vitest"
import { plansPath } from "@/features/billing/paywall"

describe("plansPath", () => {
  it("carries the page to return to after payment", () => {
    expect(plansPath("/analyze?uyarla=abc")).toBe("/plans?donus=%2Fanalyze%3Fuyarla%3Dabc")
  })

  it("drops a return address that leaves the site", () => {
    expect(plansPath("https://kotu.example")).toBe("/plans")
    expect(plansPath("//kotu.example")).toBe("/plans")
  })
})
