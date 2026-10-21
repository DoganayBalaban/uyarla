import { describe, expect, it } from "vitest"
import { DEFAULT_SCORING_CONFIG, SCORING_REVISION } from "@uyarla/core/score/config"
import { scoreImpacts } from "@/features/analysis/scoreImpact"

describe("score impact badges (DOG-132)", () => {
  it("derives the labels from the current formula", () => {
    const i = scoreImpacts(SCORING_REVISION)
    expect(i.requirements).toMatchObject({ tone: "scored", hint: "Zorunlu bir gereksinim skorda tercih edilenin 2 katı sayılır." })
    expect(i.title).toMatchObject({ tone: "scored", hint: "İlandaki unvan skorda bir zorunlu gereksinim kadar sayılır." })
    expect(i.soft?.tone).toBe("unscored")
    expect(i.conditions?.tone).toBe("unscored")
    expect(i.format.hint).toContain("yalnızca unvan bulgusu")
  })

  it("follows the weights when they change", () => {
    const i = scoreImpacts(SCORING_REVISION, { ...DEFAULT_SCORING_CONFIG, mustWeight: 1.5, titleWeight: 3, unscoredTypes: ["condition"] })
    expect(i.requirements.hint).toBe("Zorunlu bir gereksinim skorda tercih edilenin 1,5 katı sayılır.")
    expect(i.title?.hint).toBe("İlandaki unvan skorda tercih edilen bir gereksinimin 3 katı sayılır.")
    expect(i.soft).toBeNull()
  })

  it("makes no claim about the title or unscored types on the legacy formula", () => {
    const i = scoreImpacts(1)
    expect(i.title).toBeNull()
    expect(i.soft).toBeNull()
    expect(i.conditions).toBeNull()
    expect(i.format.hint).not.toContain("unvan")
  })
})
