import { describe, it, expect } from "vitest"
import { checkSemanticDrift } from "./drift.js"

const ESIK = 0.75

describe("checkSemanticDrift", () => {
  it("aynı vektörde uyarı üretmez", () => {
    expect(checkSemanticDrift([1, 0], [1, 0], ESIK)).toEqual([])
  })

  it("eşiğin altındaki benzerlikte uyarı üretir", () => {
    const uyarilar = checkSemanticDrift([1, 0], [0, 1], ESIK)
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.kind).toBe("semantic_drift")
  })

  it("eşiğin tam üstünde uyarı üretmez", () => {
    // 0.8 > 0.75: sınır davranışı kapsayıcı olmalı, yoksa eşik ayarı
    // beklenmedik yerde kayar.
    const uyarilar = checkSemanticDrift([0.8, 0.6], [1, 0], 0.75)
    expect(uyarilar).toEqual([])
  })

  it("eşiğe tam eşitken uyarı üretmez", () => {
    expect(checkSemanticDrift([1, 0], [1, 0], 1)).toEqual([])
  })

  it("gerekçe kullanıcıya gösterilebilir Türkçe olur", () => {
    const uyari = checkSemanticDrift([1, 0], [0, 1], ESIK)[0]!
    expect(uyari.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(uyari.detail).not.toMatch(/drift|cosine|threshold/i)
  })
})
