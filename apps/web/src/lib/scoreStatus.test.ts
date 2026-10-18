import { describe, expect, it } from "vitest"
import { scoreStatus } from "@/lib/scoreStatus"

describe("scoreStatus", () => {
  // DOG-103: 20 çiftlik setde, formülün 2. sürümüyle (soft hariç, unvan
  // dahil) düşük beklenenler 0–19, yüksek beklenenler 37–83 aldı.
  it("labels by the thresholds fitted on the evaluation set", () => {
    expect(scoreStatus(21).label).toBe("Düşük uyum")
    expect(scoreStatus(22).label).toBe("Orta uyum")
    expect(scoreStatus(34).label).toBe("Orta uyum")
    expect(scoreStatus(35).label).toBe("Yüksek uyum")
    expect(scoreStatus(83).label).toBe("Yüksek uyum")
  })
})
