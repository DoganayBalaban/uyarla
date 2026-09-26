import { describe, it, expect, vi } from "vitest"
import { AuthError } from "./authz"
import { RATE_LIMITS, enforceRateLimit, type RateLimitStore } from "./rateLimit"

/** Sayaç değerlerini sırayla döndüren sahte depo. */
function sahteDepo(degerler: number[]): RateLimitStore & { cagrilar: string[] } {
  const cagrilar: string[] = []
  let i = 0
  return {
    cagrilar,
    incr: vi.fn(async (key: string) => {
      cagrilar.push(key)
      return degerler[i++] ?? 1
    }),
  }
}

const kural = { limit: 3, windowSeconds: 3600 }

describe("enforceRateLimit", () => {
  it("limit altındayken geçirir", async () => {
    await expect(enforceRateLimit(sahteDepo([1]), "k", kural)).resolves.toBeUndefined()
    await expect(enforceRateLimit(sahteDepo([3]), "k", kural)).resolves.toBeUndefined()
  })

  it("limit aşılınca 429 fırlatır", async () => {
    try {
      await enforceRateLimit(sahteDepo([4]), "k", kural)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(429)
      expect((e as AuthError).code).toBe("limit_asildi")
    }
  })

  it("mesaj Türkçe ve suçlamayan", async () => {
    // Marka rehberi §6: kullanıcıyı suçlamıyoruz.
    try {
      await enforceRateLimit(sahteDepo([9]), "k", kural)
    } catch (e) {
      expect((e as AuthError).message).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
      expect((e as AuthError).message).not.toMatch(/çok fazla istek attın|engellendin/i)
    }
  })

  it("anahtarı çağrının kendisiyle birlikte üretir", async () => {
    // Aynı kullanıcının analiz ve uyarlama limitleri karışmamalı.
    const depo = sahteDepo([1])
    await enforceRateLimit(depo, "analiz:u1", kural)
    expect(depo.cagrilar[0]).toContain("analiz:u1")
  })

  it("pencere numarasını anahtara katıyor", async () => {
    // Süre dolduğunda anahtar da değişiyor ve sayaç kendiliğinden sıfırlanıyor.
    // Katmazsak anahtar sonsuza kadar aynı kalır ve kullanıcı kalıcı olarak
    // kilitlenir.
    const depo = sahteDepo([1])
    await enforceRateLimit(depo, "analiz:u1", kural)
    const beklenenPencere = Math.floor(Date.now() / 1000 / kural.windowSeconds)
    expect(depo.cagrilar[0]).toContain(String(beklenenPencere))
  })

  it("varsayılan limitler tanımlı", () => {
    // Değerler tahmin; yapılandırmada durmaları bilinçli (spec §9).
    expect(RATE_LIMITS.anonim.limit).toBe(3)
    expect(RATE_LIMITS.kayitli.limit).toBe(10)
    expect(RATE_LIMITS.anonim.windowSeconds).toBe(3600)
  })
})
