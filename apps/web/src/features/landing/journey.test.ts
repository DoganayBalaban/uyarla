import { describe, expect, it } from "vitest"
import { FEATURE_ROWS } from "@/features/billing/plans"
import { JOURNEY, accessChips, accessText } from "@/features/landing/journey"

describe("journey (DOG-160)", () => {
  it("has the six steps in order with anchors", () => {
    expect(JOURNEY.map((s) => s.id)).toEqual(["bul", "uyarla", "basvur", "takip", "hazirlan", "gorunur"])
    expect(JOURNEY.map((s) => s.number)).toEqual(["01", "02", "03", "04", "05", "06"])
  })

  it("only points at rows the pricing table has", () => {
    const labels = new Set<string>(FEATURE_ROWS.map((r) => r.label))
    for (const s of JOURNEY) for (const r of s.rows) expect(labels.has(r.label), r.label).toBe(true)
  })

  it("words access from the pricing table", () => {
    expect(accessText(true)).toBe("Ücretsiz")
    expect(accessText("Ayda 1")).toBe("Ayda 1 ücretsiz")
    expect(accessText(false)).toBe("Abonelikte")
  })

  it("shows both a free and a paid chip where a step mixes them", () => {
    const linkedin = accessChips(JOURNEY.find((s) => s.id === "gorunur")!)
    expect(linkedin.some((c) => !c.paid)).toBe(true)
    expect(linkedin.some((c) => c.paid)).toBe(true)
    expect(accessChips(JOURNEY.find((s) => s.id === "bul")!)).toEqual([{ short: "İş arama", access: "Ücretsiz", paid: false }])
  })
})
