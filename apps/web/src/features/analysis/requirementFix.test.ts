import { describe, expect, it } from "vitest"
import { correctionKind, exclusionLabel, REASON_OPTIONS, requirementMenu } from "@/features/analysis/requirementFix"

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

describe("requirementMenu (DOG-146)", () => {
  const base = { canChange: true, canShowInPosting: true, kind: null, inlineFix: false, corrected: false } as const

  it("keeps a missing year or degree fix on the row, the rest in the menu", () => {
    const years = requirementMenu({ ...base, kind: "years", inlineFix: true })
    expect(years.inline).toBe("Yıl yanlış mı okunmuş? Düzelt")
    expect(years.menu.map((m) => m.key)).toEqual(["show", "mark"])
    expect(requirementMenu({ ...base, kind: "terms", inlineFix: true }).inline).toBe("Bölüm yanlış mı okunmuş? Düzelt")
  })

  it("puts a general or changed correction in the menu", () => {
    expect(requirementMenu({ ...base, kind: "years" }).menu.map((m) => m.label)).toEqual([
      "İlanda göster",
      "Şartı düzelt",
      "Bu şartta sorun var",
    ])
    const changed = requirementMenu({ ...base, kind: "terms", inlineFix: true, corrected: true })
    expect(changed.inline).toBeNull()
    expect(changed.menu.map((m) => m.label)).toContain("Düzeltmeyi değiştir")
  })

  it("offers only 'show in posting' when the user cannot change requirements", () => {
    expect(requirementMenu({ ...base, canChange: false, kind: "years", inlineFix: true })).toEqual({
      inline: null,
      menu: [{ key: "show", label: "İlanda göster" }],
    })
    expect(requirementMenu({ ...base, canChange: false, canShowInPosting: false }).menu).toEqual([])
  })
})
