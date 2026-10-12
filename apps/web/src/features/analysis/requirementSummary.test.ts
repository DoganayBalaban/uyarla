import { describe, expect, it } from "vitest"
import { isPartial, summarizeRequirements } from "@/features/analysis/requirementSummary"

const req = (importance: string, status: "matched" | "missing", method: string | null = "keyword", confidence = 1) => ({
  requirement: { text: "x", importance, type: "skill" },
  status,
  method,
  confidence,
  evidence: null,
})

describe("summarizeRequirements", () => {
  it("counts must-have requirements separately", () => {
    const s = summarizeRequirements([
      req("must", "matched"),
      req("must", "missing", null, 0),
      req("must", "matched", "semantic", 0.62),
      req("nice", "matched"),
    ])
    expect(s).toEqual({ total: 4, matched: 3, mustTotal: 3, mustMatched: 2, partial: 0 })
  })

  it("counts keyword matches that cover only some concepts as partial", () => {
    // Bileşik gereksinimde kavramların bir kısmı tuttu (K-23): confidence oran.
    const s = summarizeRequirements([req("must", "matched", "keyword", 0.5), req("nice", "matched", "keyword", 1)])
    expect(s.partial).toBe(1)
  })
})

describe("isPartial", () => {
  it("does not treat a semantic similarity below one as partial", () => {
    // Anlamsal eşleşmede confidence benzerlik değeri, kapsam oranı değil.
    expect(isPartial(req("must", "matched", "semantic", 0.6))).toBe(false)
    expect(isPartial(req("must", "missing", null, 0))).toBe(false)
    expect(isPartial(req("must", "matched", "keyword", 0.34))).toBe(true)
  })
})
