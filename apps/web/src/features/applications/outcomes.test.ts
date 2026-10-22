import { describe, expect, it } from "vitest"
import { outcomesByBand, personalOutcomeSignal } from "@/features/applications/outcomes"

const card = (score: number | null, stage: "saved" | "applied" | "interview" | "offer" | "rejected") => ({ score, stage })

describe("outcomes by score band (DOG-124)", () => {
  it("counts resolved and positive outcomes with the screen's thresholds", () => {
    const bands = outcomesByBand([
      card(40, "interview"),
      card(36, "offer"),
      card(35, "rejected"),
      card(50, "applied"),
      card(30, "rejected"),
      card(10, "saved"),
      card(null, "interview"),
    ])
    expect(bands).toEqual([
      { label: "Yüksek uyum", resolved: 3, positive: 2, waiting: 1 },
      { label: "Orta uyum", resolved: 1, positive: 0, waiting: 0 },
      { label: "Düşük uyum", resolved: 0, positive: 0, waiting: 0 },
    ])
  })

  it("shows the user a signal only after three resolved applications, from their own board", () => {
    expect(personalOutcomeSignal([card(40, "interview"), card(30, "rejected"), card(50, "applied")])).toBeNull()
    expect(personalOutcomeSignal([card(40, "interview"), card(36, "rejected"), card(20, "rejected")])).toEqual([
      "Yüksek uyumlu 2 sonuçlanmış başvurunun 1 tanesi mülakata döndü.",
      "Düşük uyumlu 1 sonuçlanmış başvurunun 0 tanesi mülakata döndü.",
    ])
  })
})
