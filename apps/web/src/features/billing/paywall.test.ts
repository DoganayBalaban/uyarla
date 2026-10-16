import { describe, expect, it } from "vitest"
import { plansPath, safePlansReturn } from "@/features/billing/paywall"

describe("plansPath", () => {
  it("carries the page to return to after payment", () => {
    expect(plansPath("/analyze?uyarla=abc")).toBe("/plans?donus=%2Fanalyze%3Fuyarla%3Dabc")
  })

  it("drops a return address that leaves the site", () => {
    expect(plansPath("https://kotu.example")).toBe("/plans")
    expect(plansPath("//kotu.example")).toBe("/plans")
  })

  it("drops a backslash trick that browsers read as another site", () => {
    // Gözden geçirme: "/\\evil.com" startsWith("/") testini geçiyordu, tarayıcı onu https://evil.com sayıyor.
    expect(plansPath("/\\evil.com")).toBe("/plans")
    expect(safePlansReturn("/\\evil.com")).toBeNull()
    expect(safePlansReturn("/analyze?uyarla=abc")).toBe("/analyze?uyarla=abc")
    expect(safePlansReturn(undefined)).toBeNull()
  })
})

