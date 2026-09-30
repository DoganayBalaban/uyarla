import { describe, it, expect } from "vitest"
import { checkSemanticDrift } from "./drift.js"

const THRESHOLD = 0.75

describe("checkSemanticDrift", () => {
  it("produces no warning for identical vectors", () => {
    expect(checkSemanticDrift([1, 0], [1, 0], THRESHOLD)).toEqual([])
  })

  it("warns for similarity below the threshold", () => {
    const warnings = checkSemanticDrift([1, 0], [0, 1], THRESHOLD)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.kind).toBe("semantic_drift")
  })

  it("does not warn just above the threshold", () => {
    // 0.8 > 0.75: sınır davranışı kapsayıcı olmalı, yoksa eşik ayarı
    // beklenmedik yerde kayar.
    const warnings = checkSemanticDrift([0.8, 0.6], [1, 0], 0.75)
    expect(warnings).toEqual([])
  })

  it("does not warn exactly at the threshold", () => {
    expect(checkSemanticDrift([1, 0], [1, 0], 1)).toEqual([])
  })

  it("the reason is user-facing Turkish", () => {
    const warning = checkSemanticDrift([1, 0], [0, 1], THRESHOLD)[0]!
    expect(warning.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(warning.detail).not.toMatch(/drift|cosine|threshold/i)
  })
})
