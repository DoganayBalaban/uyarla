import { describe, expect, it } from "vitest"
import { correctionKind, exclusionLabel, REASON_OPTIONS } from "@/features/analysis/requirementFix"

describe("exclusionLabel (DOG-90)", () => {
  it("says why a requirement is out of the score", () => {
    expect(exclusionLabel({ reason: "not_in_posting", scope: "analysis" })).toBe("İlanda yok olarak işaretlendi")
    expect(exclusionLabel({ reason: "irrelevant", scope: "always" })).toBe("İlgisiz olarak işaretlendi · listende")
    expect(exclusionLabel({ reason: "irrelevant", scope: "profile" })).toBe("Hariç tuttuğun kavramlar listende")
    // PR 117'den kalan işaretlerde neden yok.
    expect(exclusionLabel(undefined)).toBe("İlanda yok olarak işaretlendi")
  })
})

describe("correctionKind (DOG-90)", () => {
  it("lets years be fixed on experience and terms on education only", () => {
    expect(correctionKind("experience")).toBe("years")
    expect(correctionKind("education")).toBe("terms")
    expect(correctionKind("skill")).toBeNull()
    expect(correctionKind("soft")).toBeNull()
  })
})

describe("REASON_OPTIONS", () => {
  it("only offers 'all postings' for reasons that exclude", () => {
    expect(REASON_OPTIONS.map((r) => [r.value, r.canRemember])).toEqual([
      ["not_in_posting", true],
      ["irrelevant", true],
      ["found_in_cv", false],
    ])
  })
})
