import { describe, expect, it } from "vitest"
import { SCORING_REVISION } from "@uyarla/core/score/config"
import { guideSteps } from "@/features/analysis/components/ResultGuide"
import { scoreImpacts } from "@/features/analysis/scoreImpact"

describe("result guide (DOG-139)", () => {
  it("says the score is fit to the posting, with the formula's weights", () => {
    const [first, ...rest] = guideSteps(scoreImpacts(SCORING_REVISION))
    expect(first!.body).toContain("işe uygunluğunu değil")
    expect(first!.body).toContain("tercih edilenin 2 katı")
    expect(first!.body).toContain("bir zorunlu gereksinim kadar")
    expect(rest).toHaveLength(3)
  })

  it("leaves the title out on the legacy formula", () => {
    expect(guideSteps(scoreImpacts(1))[0]!.body).not.toContain("unvan")
  })
})
