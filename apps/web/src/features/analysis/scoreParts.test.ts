import { describe, expect, it } from "vitest"
import { scoringConfigFor } from "@uyarla/core/score/config"
import { weightedScore } from "@uyarla/core/score/score"
import { scoreParts } from "@/features/analysis/scoreParts"

const req = (text: string, importance: string, type: string, confidence: number, concepts = [{ term: text, synonyms: [] }]) => ({
  requirement: { text, importance, type, concepts },
  confidence,
})

const requirements = [
  req("Dijital pazarlamada 2 yıl", "must", "experience", 1),
  req("Google Ads ve Meta", "must", "skill", 0.5),
  req("Google Analytics 4", "must", "skill", 0),
  req("İşletme lisansı", "must", "education", 1),
  req("E-posta pazarlama", "nice", "skill", 0),
  req("Ekip çalışması", "nice", "soft", 0),
  req("Ehliyet", "must", "condition", 0),
]

// Core'un formülüyle aynı skor; şerit ekranda formülde olmayan bir şey çizmesin.
const core = (excluded: number[], title: { level: "exact" | "partial" | "none" } | null, revision: number) =>
  weightedScore(requirements as never, scoringConfigFor(revision), excluded, title)

describe("scoreParts", () => {
  it.each([
    [[], null, 3],
    [[], { level: "none" as const }, 3],
    [[], { level: "partial" as const }, 3],
    [[2], { level: "none" as const }, 3],
    [[], { level: "none" as const }, 2],
    [[], null, 1],
  ])("adds up to the core score (excluded %j, title %j, revision %i)", (excluded, title, revision) => {
    const { score } = scoreParts({
      requirements,
      excluded,
      titleMatch: title ? { ...title, position: "Dijital Pazarlama Uzmanı" } : null,
      scoringRevision: revision,
    })
    expect(score).toBe(core(excluded, title, revision))
  })

  it("sizes parts by weight and leaves soft skills and conditions out", () => {
    const { parts } = scoreParts({
      requirements,
      titleMatch: { level: "none", position: "Dijital Pazarlama Uzmanı" },
      scoringRevision: 3,
    })
    expect(parts.map((p) => [p.kind, p.weight, p.credit])).toEqual([
      ["must", 2, 1],
      ["must", 2, 0.5],
      ["must", 2, 0],
      ["generic", 1, 1],
      ["nice", 1, 0],
      ["title", 2, 0],
    ])
    // Toplam ağırlık 10: eksik bir zorunlu 20 puan, yarım karşılanan 10.
    expect(parts.map((p) => p.gain)).toEqual([0, 10, 20, 0, 10, 20])
  })

  it("returns nothing when every requirement is marked as misread", () => {
    expect(scoreParts({ requirements: requirements.slice(0, 1), excluded: [0], scoringRevision: 3 })).toEqual({ parts: [], score: 0 })
  })
})
