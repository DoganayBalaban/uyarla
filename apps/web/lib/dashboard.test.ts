import { describe, expect, it } from "vitest"
import { ozetle } from "./dashboard"
import type { PanoKarti } from "./pano"

function kart(ek: Partial<PanoKarti> = {}): PanoKarti {
  return {
    analysisId: "a1",
    pozisyon: "Frontend Geliştirici",
    skor: 47,
    asama: "saved",
    asamaTarihi: null,
    not: null,
    olusturulma: "2026-09-20T10:00:00.000Z",
    uyarlama: null,
    ...ek,
  }
}

describe("dashboard özeti", () => {
  it("her aşamayı sayıyor, boş aşama sıfır", () => {
    const o = ozetle([kart(), kart({ asama: "applied" }), kart({ asama: "applied" })])
    expect(o.asamaSayilari).toEqual({ saved: 1, applied: 2, interview: 0, offer: 0, rejected: 0 })
    expect(o.toplam).toBe(3)
  })

  it("bekleyenler: karar bekleyen uyarlama en önde, sonra hazır CV, sonra uyarlanmamış analiz", () => {
    const o = ozetle([
      kart({ analysisId: "uyarlanmadi", olusturulma: "2026-09-25T00:00:00Z" }),
      kart({ analysisId: "hazir", uyarlama: { id: "u2", durum: "ready" } }),
      kart({ analysisId: "karar", uyarlama: { id: "u1", durum: "draft" } }),
    ])
    expect(o.bekleyenler.map((b) => [b.tur, b.analysisId])).toEqual([
      ["karar", "karar"],
      ["hazir", "hazir"],
      ["uyarla", "uyarlanmadi"],
    ])
    expect(o.bekleyenler[0]?.adres).toBe("/adapt/u1")
    expect(o.bekleyenler[2]?.adres).toBe("/analyze?analiz=uyarlanmadi")
  })

  it("başvurulmuş ya da sonuçlanmış ilan bekleyen sayılmıyor", () => {
    const o = ozetle([
      kart({ asama: "applied", uyarlama: { id: "u1", durum: "ready" } }),
      kart({ asama: "rejected" }),
      // Karar bekleyen madde aşamadan bağımsız: indirme kapalı kalıyor.
      kart({ analysisId: "k", asama: "interview", uyarlama: { id: "u3", durum: "draft" } }),
    ])
    expect(o.bekleyenler.map((b) => b.analysisId)).toEqual(["k"])
  })

  it("süren ya da düşen uyarlama bekleyen değil", () => {
    const o = ozetle([
      kart({ uyarlama: { id: "u1", durum: "running" } }),
      kart({ uyarlama: { id: "u2", durum: "failed" } }),
    ])
    expect(o.bekleyenler).toEqual([])
  })

  it("son analizler en yeniden eskiye, en fazla beş", () => {
    const kartlar = Array.from({ length: 7 }, (_, i) =>
      kart({ analysisId: `a${i}`, olusturulma: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00Z` }),
    )
    expect(ozetle(kartlar).sonAnalizler.map((k) => k.analysisId)).toEqual(["a6", "a5", "a4", "a3", "a2"])
  })
})
