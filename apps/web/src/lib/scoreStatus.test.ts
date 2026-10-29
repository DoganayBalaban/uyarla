import { describe, expect, it } from "vitest"
import { scoreStatus } from "@/lib/scoreStatus"

describe("scoreStatus", () => {
  // DOG-165: 20 çiftlik sette, formülün 3. sürümüyle düşük beklenenler 0–25,
  // orta beklenenler 17–45, yüksek beklenenler 37–80 aldı; 30/50 eşiği 18/20.
  it("labels a revision 3 score by the thresholds fitted on the evaluation set", () => {
    expect(scoreStatus(29).label).toBe("Düşük uyum")
    expect(scoreStatus(30).label).toBe("Orta uyum")
    expect(scoreStatus(49).label).toBe("Orta uyum")
    expect(scoreStatus(50).label).toBe("Yüksek uyum")
    expect(scoreStatus(80, 3).label).toBe("Yüksek uyum")
  })

  // DOG-103: 2. sürümde düşük beklenenler 0–19, yüksek beklenenler 37–83.
  it("keeps the revision 2 thresholds for scores saved with that formula", () => {
    expect(scoreStatus(21, 2).label).toBe("Düşük uyum")
    expect(scoreStatus(22, 2).label).toBe("Orta uyum")
    expect(scoreStatus(34, 2).label).toBe("Orta uyum")
    expect(scoreStatus(35, 2).label).toBe("Yüksek uyum")
    expect(scoreStatus(35, 1).label).toBe("Yüksek uyum")
  })
})
