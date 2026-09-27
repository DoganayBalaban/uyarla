import { describe, expect, it } from "vitest"
import { gecerliAsama, panoKarti, pozisyonAdi, sutunlaraDagit, type PanoSatiri } from "./pano"

function satir(ek: Partial<PanoSatiri> = {}): PanoSatiri {
  return {
    id: "a1",
    score: 47.6,
    stage: "saved",
    stageChangedAt: null,
    note: null,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    jobPosting: { position: "Frontend Geliştirici", rawText: "ilan" },
    adaptation: null,
    ...ek,
  }
}

describe("pano", () => {
  it("aşama doğrulaması", () => {
    expect(gecerliAsama("interview")).toBe(true)
    expect(gecerliAsama("hired")).toBe(false)
    expect(gecerliAsama(3)).toBe(false)
  })

  it("pozisyon boşsa ilanın ilk satırı", () => {
    expect(pozisyonAdi("", "\n  Kıdemli Veri Analisti\nAçıklama")).toBe("Kıdemli Veri Analisti")
    expect(pozisyonAdi("", "")).toBe("İsimsiz ilan")
    expect(pozisyonAdi("", "x".repeat(100))).toHaveLength(78)
  })

  it("kart: skor yuvarlanıyor, bilinmeyen aşama kaydedildi sayılıyor", () => {
    const k = panoKarti(satir({ stage: "eski", adaptation: { id: "ad1", status: "ready" } }))
    expect(k.skor).toBe(48)
    expect(k.asama).toBe("saved")
    expect(k.uyarlama).toEqual({ id: "ad1", durum: "ready" })
  })

  it("sütunlara dağıtıyor, en son hareket eden üstte", () => {
    const kartlar = [
      panoKarti(satir({ id: "eski", stage: "applied", stageChangedAt: new Date("2026-09-21") })),
      panoKarti(satir({ id: "yeni", stage: "applied", stageChangedAt: new Date("2026-09-25") })),
      panoKarti(satir({ id: "k", stage: "saved" })),
    ]
    const s = sutunlaraDagit(kartlar)
    expect(s.applied.map((k) => k.analysisId)).toEqual(["yeni", "eski"])
    expect(s.saved).toHaveLength(1)
    expect(s.offer).toEqual([])
  })
})
