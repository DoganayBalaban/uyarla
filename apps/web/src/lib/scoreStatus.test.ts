import { describe, expect, it } from "vitest"
import { scoreStatus } from "@/lib/scoreStatus"

describe("scoreStatus", () => {
  // DOG-66: 18 çiftlik değerlendirme setinde yüksek uyum beklenen çiftler
  // 24–59, düşük beklenenler 0–18 aldı; 40/70 eşiğinde hiçbiri "Yüksek" değildi.
  it("labels by the thresholds fitted on the evaluation set", () => {
    expect(scoreStatus(19).label).toBe("Düşük uyum")
    expect(scoreStatus(20).label).toBe("Orta uyum")
    expect(scoreStatus(29).label).toBe("Orta uyum")
    expect(scoreStatus(30).label).toBe("Yüksek uyum")
    expect(scoreStatus(59).label).toBe("Yüksek uyum")
  })
})
