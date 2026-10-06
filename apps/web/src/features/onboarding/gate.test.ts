import { describe, expect, it } from "vitest"
import { needsOnboarding, onboardingGate, onboardingPath } from "@/features/onboarding/gate"

describe("needsOnboarding", () => {
  it("is true only for a registered user who has not finished", () => {
    expect(needsOnboarding({ isAnonymous: false, onboardedAt: null })).toBe(true)
    expect(needsOnboarding({ isAnonymous: false, onboardedAt: new Date() })).toBe(false)
    expect(needsOnboarding({ isAnonymous: true, onboardedAt: null })).toBe(false)
    expect(needsOnboarding(null)).toBe(false)
  })
})

describe("onboardingPath", () => {
  it("keeps the query string of the target", () => {
    expect(onboardingPath("/analyze?uyarla=abc")).toBe("/onboarding?donus=%2Fanalyze%3Fuyarla%3Dabc")
  })

  it("never points back to onboarding or outside the site", () => {
    expect(onboardingPath("/onboarding?donus=/x")).toBe("/onboarding?donus=%2Fanalyze")
    expect(onboardingPath("https://kotu.site")).toBe("/onboarding?donus=%2Fanalyze")
  })
})

describe("onboardingGate", () => {
  it("sends a visitor without a session to login, coming back to onboarding", () => {
    expect(onboardingGate({ session: null, onboardedAt: null, donus: "/dashboard" })).toEqual({
      kind: "login",
      to: "/login?donus=%2Fonboarding%3Fdonus%3D%252Fdashboard",
    })
  })

  it("skips straight to the target for anonymous and finished users", () => {
    expect(onboardingGate({ session: { isAnonymous: true }, onboardedAt: null, donus: "/analyze?uyarla=1" })).toEqual({
      kind: "skip",
      to: "/analyze?uyarla=1",
    })
    expect(
      onboardingGate({ session: { isAnonymous: false }, onboardedAt: new Date(), donus: "/dashboard" }),
    ).toEqual({ kind: "skip", to: "/dashboard" })
  })

  it("shows onboarding with a safe target", () => {
    expect(onboardingGate({ session: { isAnonymous: false }, onboardedAt: null, donus: "https://kotu.site" })).toEqual({
      kind: "show",
      returnTo: "/analyze",
    })
  })
})
