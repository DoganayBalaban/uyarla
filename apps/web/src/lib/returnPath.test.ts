import { describe, expect, it } from "vitest"
import { DEFAULT_RETURN_PATH, loginPath, safeReturnPath, returnPathFromSearchParams } from "@/lib/returnPath"

describe("safeReturnPath", () => {
  it.each([
    ["/analyze?uyarla=abc", "/analyze?uyarla=abc"],
    ["/adapt/xyz", "/adapt/xyz"],
    ["/account", "/account"],
    ["/analyze#sonuc", "/analyze#sonuc"],
  ])("accepts internal %s", (inputValue, expected) => {
    expect(safeReturnPath(inputValue)).toBe(expected)
  })

  it.each([
    null,
    undefined,
    "",
    "https://kotu.site",
    "//kotu.site",
    "/\\kotu.site",
    "javascript:alert(1)",
    "analyze",
    "/\t/kotu.site",
    "/login",
    "/login?donus=/analyze",
  ])("rejects %s", (inputValue) => {
    expect(safeReturnPath(inputValue)).toBe(DEFAULT_RETURN_PATH)
  })
})

describe("loginPath", () => {
  it("adds no parameter for the default return path", () => {
    expect(loginPath()).toBe("/login")
    expect(loginPath("/analyze")).toBe("/login")
  })

  it("encodes the return path", () => {
    expect(loginPath("/analyze?uyarla=a1")).toBe("/login?donus=%2Fanalyze%3Fuyarla%3Da1")
  })
})

describe("returnPathFromSearchParams", () => {
  it("reads the Turkish ?donus= parameter that loginPath writes", () => {
    const fromLink = new URL(`https://uyarla.local${loginPath("/analyze?uyarla=abc")}`)
    const params = Object.fromEntries(fromLink.searchParams)
    expect(returnPathFromSearchParams(params)).toBe("/analyze?uyarla=abc")
  })

  it("takes the first value and falls back to the default", () => {
    expect(returnPathFromSearchParams({ donus: ["/dashboard", "/x"] })).toBe("/dashboard")
    expect(returnPathFromSearchParams({})).toBe("/analyze")
    expect(returnPathFromSearchParams({ donus: "https://kotu.site" })).toBe("/analyze")
  })
})
