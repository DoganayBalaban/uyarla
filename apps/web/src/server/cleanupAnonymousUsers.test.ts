import { describe, it, expect } from "vitest"
import { RETENTION_DAYS as RETENTION_DAYS, staleAnonymousWhere as staleAnonymousWhere, cutoffDate as cutoffDate } from "@/server/cleanupAnonymousUsers"

const NOW = new Date("2026-09-27T12:00:00.000Z")

describe("cutoffDate", () => {
  it("defaults to 30 days back", () => {
    expect(RETENTION_DAYS).toBe(30)
    expect(cutoffDate(NOW).toISOString()).toBe("2026-08-28T12:00:00.000Z")
  })

  it("accepts a day count", () => {
    expect(cutoffDate(NOW, 1).toISOString()).toBe("2026-09-26T12:00:00.000Z")
  })

  it("rejects zero or negative days", () => {
    // 0 gün "az önce gelen ziyaretçiyi de sil" demek: elini tam o anda
    // CV'sinin üzerinde olan kullanıcının verisini siler.
    expect(() => cutoffDate(NOW, 0)).toThrow(/gün/i)
    expect(() => cutoffDate(NOW, -5)).toThrow(/gün/i)
  })
})

describe("staleAnonymousWhere", () => {
  it("keeps only anonymous users older than the cutoff", () => {
    // Bu dosyanın en kritik iddiası: iki koşuldan biri düşerse kayıtlı
    // kullanıcıların ya da dünkü ziyaretçilerin verisi silinir.
    expect(staleAnonymousWhere(NOW)).toEqual({
      isAnonymous: true,
      createdAt: { lt: new Date("2026-08-28T12:00:00.000Z") },
    })
  })

  it("the isAnonymous condition is exactly `true`, not truthiness", () => {
    // Alan şemada nullable (`Boolean?`, K-34). `not: false` yazılsaydı NULL
    // taşıyan kayıtlı kullanıcılar da eşleşirdi.
    const condition = staleAnonymousWhere(NOW)
    expect(condition.isAnonymous).toBe(true)
  })

  it("the cutoff is `lt`, not `lte`", () => {
    // Sınırda duran kaydı bırakıyoruz: geri alınamaz bir işlemde eşitlik
    // hâlinde silmemek doğru taraf.
    expect(staleAnonymousWhere(NOW, 30).createdAt).toEqual({
      lt: new Date("2026-08-28T12:00:00.000Z"),
    })
  })
})
