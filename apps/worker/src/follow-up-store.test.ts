import { describe, expect, it } from "vitest"
import { missingMustRequirements } from "./follow-up-store.js"

const must = (text: string, status: string) => ({ requirement: { text, importance: "must", type: "skill" }, status })

describe("missingMustRequirements", () => {
  const result = {
    requirements: [must("Google Ads", "missing"), must("Çok pazarlı reklam", "missing")],
    adapted: { score: 75, statuses: ["matched", "missing"], titleLevel: null },
  }

  it("lists what the adapted CV still lacks once there is an adaptation (DOG-166)", () => {
    // Kullanıcı testi: mülakat paketi uyarlamadan önceki eksikleri sayıyordu.
    expect(missingMustRequirements(result, true)).toEqual(["Çok pazarlı reklam"])
  })

  it("uses the analysis when nothing was adapted", () => {
    expect(missingMustRequirements(result, false)).toEqual(["Google Ads", "Çok pazarlı reklam"])
  })
})
