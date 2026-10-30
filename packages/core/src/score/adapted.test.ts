import { describe, expect, it } from "vitest"
import { adaptedSummary, withAdaptation } from "./adapted.js"

const result = {
  scoringRevision: 3,
  requirements: [
    { requirement: { text: "A", importance: "must", type: "skill" }, status: "missing" },
    { requirement: { text: "B", importance: "must", type: "skill" }, status: "missing" },
    { requirement: { text: "C", importance: "nice", type: "skill" }, status: "matched" },
  ],
  titleMatch: { level: "none" as const, position: "Uzman" },
}

describe("adapted result (DOG-166)", () => {
  it("summarizes the adapted outcome in requirement order", () => {
    expect(
      adaptedSummary({ score: 75, requirements: [{ status: "matched" }, { status: "missing" }, { status: "matched" }], titleMatch: { level: "partial", position: "Uzman" } }),
    ).toEqual({ score: 75, statuses: ["matched", "missing", "matched"], titleLevel: "partial" })
  })

  it("reads the analysis as the adapted CV stands", () => {
    // Kullanıcı testi: uyarlanmış CV 75 iken pano, ayrıntı ve mülakat paketi 58 ve "2 zorunlu eksik" gösteriyordu.
    const adapted = withAdaptation({ ...result, adapted: { score: 75, statuses: ["matched", "missing", "matched"], titleLevel: "partial" } })
    expect(adapted.requirements.map((r) => r.status)).toEqual(["matched", "missing", "matched"])
    expect(adapted.titleMatch).toEqual({ level: "partial", position: "Uzman" })
    expect(adapted.adaptedScore).toBe(75)
  })

  it("leaves a result without a matching summary as it is", () => {
    expect(withAdaptation(result)).toEqual({ ...result, adaptedScore: null })
    // Gereksinim sayısı tutmuyorsa (ilan yeniden çıkarıldı) özet eski: kullanılmıyor.
    expect(withAdaptation({ ...result, adapted: { score: 75, statuses: ["matched"], titleLevel: null } }).adaptedScore).toBeNull()
    expect(withAdaptation(null)).toBeNull()
  })
})
