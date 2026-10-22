import { describe, expect, it } from "vitest"
import { signUnsubscribe, unsubscribeHeaders, unsubscribeLinks, verifyUnsubscribe } from "@/server/email/unsubscribe"

const SECRET = "test-anahtar"

describe("unsubscribe tokens (DOG-127)", () => {
  it("round-trips a signed token", () => {
    const token = signUnsubscribe("u-1", "applicationReminders", SECRET)
    expect(verifyUnsubscribe(token, SECRET)).toEqual({ userId: "u-1", category: "applicationReminders" })
  })

  it("rejects a tampered user, an unknown category, another secret and a missing secret", () => {
    const token = signUnsubscribe("u-1", "applicationReminders", SECRET)
    expect(verifyUnsubscribe(token.replace("u-1", "u-2"), SECRET)).toBeNull()
    expect(verifyUnsubscribe("u-1.marketing.abc", SECRET)).toBeNull()
    expect(verifyUnsubscribe(token, "baska")).toBeNull()
    expect(verifyUnsubscribe(token, undefined)).toBeNull()
    expect(verifyUnsubscribe("bozuk", SECRET)).toBeNull()
  })

  it("builds links and one-click headers only when the secret exists", () => {
    expect(unsubscribeLinks("u-1", "applicationReminders", undefined)).toBeNull()
    const links = unsubscribeLinks("u-1", "applicationReminders", SECRET)!
    expect(links.page).toContain("/email/unsubscribe?t=")
    expect(unsubscribeHeaders(links)).toEqual({
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    })
    expect(unsubscribeHeaders(null)).toBeUndefined()
  })
})
