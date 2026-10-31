import { describe, expect, it } from "vitest"
import { extensionTarget, offersExtension } from "@/features/onboarding/extensionStep"

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const EDGE = `${CHROME_MAC} Edg/130.0.0.0`
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1"

describe("offersExtension", () => {
  it("offers the extension as the last step on desktop Chrome and Chromium browsers", () => {
    expect(offersExtension({ userAgent: CHROME_MAC, installed: false })).toBe(true)
    expect(offersExtension({ userAgent: EDGE, installed: false })).toBe(true)
  })

  it("skips it where the extension cannot run or is already there", () => {
    for (const ua of [CHROME_ANDROID, SAFARI, IPHONE_CHROME]) expect(offersExtension({ userAgent: ua, installed: false }), ua).toBe(false)
    expect(offersExtension({ userAgent: CHROME_MAC, installed: true })).toBe(false)
  })
})

describe("extensionTarget", () => {
  it("opens the store once published, the extension page before", () => {
    expect(extensionTarget("https://chromewebstore.google.com/detail/uyarla/abc")).toBe("https://chromewebstore.google.com/detail/uyarla/abc")
    expect(extensionTarget(null)).toBe("/eklenti")
  })
})
