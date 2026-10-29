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
    const apply = accessChips(JOURNEY.find((s) => s.id === "basvur")!)
    expect(apply.some((c) => !c.paid)).toBe(true)
    expect(apply.some((c) => c.paid)).toBe(true)
    expect(accessChips(JOURNEY.find((s) => s.id === "bul")!)).toEqual([{ short: "İş arama", access: "Ücretsiz", paid: false }])
  })

  it("shows no access chips on the LinkedIn step", () => {
    expect(accessChips(JOURNEY.find((s) => s.id === "gorunur")!)).toEqual([])
  })
})

describe("journey copy matches the product (son inceleme)", () => {
  const step = (id: string) => JOURNEY.find((s) => s.id === id)!
  const all = (id: string) => [step(id).title, step(id).text, ...step(id).bullets].join(" ")

  it("grounds LinkedIn suggestions in the profile, not the CV", () => {
    expect(all("gorunur")).toContain("profilindeki")
    expect(all("gorunur")).not.toMatch(/CV'n(e|deki)/)
  })

  it("describes the apply gate by missing must-haves, not a score threshold", () => {
    expect(all("takip")).toContain("zorunlu")
    expect(all("takip")).not.toMatch(/[Ss]kor düşük|[Dd]üşük skor/)
  })

  it("does not promise what search and form answers do not do", () => {
    expect(all("bul")).toContain("Hedef rolünle")
    expect(all("basvur")).not.toContain("Sınır aşılmaz")
  })
})
