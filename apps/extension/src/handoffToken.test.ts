import { describe, expect, it } from "vitest"
import { TOKEN_TTL_MS, issueToken, redeemToken, type TokenStore } from "./handoffToken.js"

const T0 = 1_800_000_000_000

describe("handoff tokens (DOG-71)", () => {
  it("a token issued by the extension is redeemed once", () => {
    const { store, token } = issueToken({}, T0, () => "t1")
    const first = redeemToken(store, token, T0 + 1000)
    expect(first.valid).toBe(true)
    // İkinci kez kullanılamıyor: yenileme ya da kopyalanan adres analiz başlatmaz.
    expect(redeemToken(first.store, token, T0 + 2000).valid).toBe(false)
  })

  it("rejects a token the extension never issued", () => {
    // Başka bir sitenin uydurduğu jeton.
    expect(redeemToken({}, "uydurma", T0).valid).toBe(false)
  })

  it("rejects an expired token", () => {
    const { store, token } = issueToken({}, T0, () => "t1")
    expect(redeemToken(store, token, T0 + TOKEN_TTL_MS + 1).valid).toBe(false)
  })

  it("drops expired tokens when issuing a new one", () => {
    const old: TokenStore = { eski: T0 - 1 }
    const { store } = issueToken(old, T0, () => "yeni")
    expect(Object.keys(store)).toEqual(["yeni"])
  })
})
