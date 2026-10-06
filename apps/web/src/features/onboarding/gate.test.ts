import { describe, expect, it } from "vitest"
import { returnPathFromSearchParams } from "@/lib/returnPath"
import {
  ONBOARDING_DEFERRED_COOKIE,
  needsOnboarding,
  onboardingGate,
  onboardingPath,
  shouldRedirectToOnboarding,
} from "@/features/onboarding/gate"

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
  it("sends a visitor without a session to login with the target (the login form wraps it in onboarding)", () => {
    expect(onboardingGate({ session: null, onboardedAt: null, donus: "/dashboard" })).toEqual({
      kind: "login",
      to: "/login?donus=%2Fdashboard",
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

describe("expired session round trip", () => {
  it("comes back to onboarding and then to the original target after login", () => {
    const target = "/analyze?uyarla=abc"
    const gate = onboardingGate({ session: null, onboardedAt: null, donus: target })
    expect(gate.kind).toBe("login")
    // Giriş sayfası donus'u okuyor, giriş formu callbackURL'i onboardingPath ile sarıyor.
    const loginUrl = new URL(`https://uyarla.local${gate.kind === "login" ? gate.to : ""}`)
    const returnTo = returnPathFromSearchParams(Object.fromEntries(loginUrl.searchParams))
    const callback = new URL(`https://uyarla.local${onboardingPath(returnTo)}`)
    const back = onboardingGate({
      session: { isAnonymous: false },
      onboardedAt: null,
      donus: callback.searchParams.get("donus") ?? undefined,
    })
    expect(back).toEqual({ kind: "show", returnTo: target })
  })
})

describe("shouldRedirectToOnboarding", () => {
  it("redirects a registered, not onboarded user unless onboarding was deferred this session", () => {
    const user = { isAnonymous: false, onboardedAt: null }
    expect(shouldRedirectToOnboarding(user, false)).toBe(true)
    expect(shouldRedirectToOnboarding(user, true)).toBe(false)
    expect(shouldRedirectToOnboarding({ isAnonymous: false, onboardedAt: new Date() }, false)).toBe(false)
    expect(shouldRedirectToOnboarding(null, false)).toBe(false)
  })

  it("names the session cookie", () => {
    expect(ONBOARDING_DEFERRED_COOKIE).toBe("onboarding_deferred")
  })
})

