import { describe, it, expect, vi } from "vitest"
import { AuthError } from "@/server/authz"
import { RATE_LIMITS, enforceRateLimit, type RateLimitStore } from "@/server/rateLimit"

/** Sayaç değerlerini sırayla döndüren sahte depo. */
function fakeStorage(vals: number[]): RateLimitStore & { callList: string[] } {
  const callList: string[] = []
  let i = 0
  return {
    callList,
    incr: vi.fn(async (key: string) => {
      callList.push(key)
      return vals[i++] ?? 1
    }),
  }
}

const rule = { limit: 3, windowSeconds: 3600 }

describe("enforceRateLimit", () => {
  it("passes under the limit", async () => {
    await expect(enforceRateLimit(fakeStorage([1]), "k", rule)).resolves.toBeUndefined()
    await expect(enforceRateLimit(fakeStorage([3]), "k", rule)).resolves.toBeUndefined()
  })

  it("throws 429 when the limit is exceeded", async () => {
    try {
      await enforceRateLimit(fakeStorage([4]), "k", rule)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(429)
      expect((e as AuthError).code).toBe("limit_asildi")
    }
  })

  it("the message is Turkish and non-blaming", async () => {
    // Marka rehberi §6: kullanıcıyı suçlamıyoruz.
    try {
      await enforceRateLimit(fakeStorage([9]), "k", rule)
    } catch (e) {
      expect((e as AuthError).message).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
      expect((e as AuthError).message).not.toMatch(/çok fazla istek attın|engellendin/i)
    }
  })

  it("builds the key with the call itself", async () => {
    // Aynı kullanıcının analiz ve uyarlama limitleri karışmamalı.
    const storage = fakeStorage([1])
    await enforceRateLimit(storage, "analiz:u1", rule)
    expect(storage.callList[0]).toContain("analiz:u1")
  })

  it("includes the window number in the key", async () => {
    // Süre dolduğunda anahtar da değişiyor ve sayaç kendiliğinden sıfırlanıyor.
    // Katmazsak anahtar sonsuza kadar aynı kalır ve kullanıcı kalıcı olarak
    // kilitlenir.
    const storage = fakeStorage([1])
    await enforceRateLimit(storage, "analiz:u1", rule)
    const expectedWindow = Math.floor(Date.now() / 1000 / rule.windowSeconds)
    expect(storage.callList[0]).toContain(String(expectedWindow))
  })

  it("default limits are defined", () => {
    // Değerler tahmin; yapılandırmada durmaları bilinçli (spec §9).
    expect(RATE_LIMITS.anonUser.limit).toBe(3)
    expect(RATE_LIMITS.registered.limit).toBe(10)
    expect(RATE_LIMITS.anonUser.windowSeconds).toBe(3600)
  })
})
