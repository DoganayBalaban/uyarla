import { describe, expect, it } from "vitest"
import { JOURNEY } from "@/features/landing/journey"

describe("journey (DOG-160)", () => {
  it("has the six steps in order with anchors", () => {
    expect(JOURNEY.map((s) => s.id)).toEqual(["bul", "uyarla", "basvur", "takip", "hazirlan", "gorunur"])
    expect(JOURNEY.map((s) => s.number)).toEqual(["01", "02", "03", "04", "05", "06"])
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
