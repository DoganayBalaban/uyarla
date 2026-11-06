import { describe, expect, it } from "vitest"
import { scoringConfigFor } from "@uyarla/core/score/config"
import { weightedScore } from "@uyarla/core/score/score"
import { groupParts, scoreParts, type ScorePart } from "@/features/analysis/scoreParts"

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

// Core'un formülüyle aynı skor; ekran formülde olmayan bir şey çizmesin.
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

describe("scoreParts: ekleme için alanlar (K-114)", () => {
  it("carries the requirement type and its missing concepts", () => {
    const { parts } = scoreParts({
      requirements: [
        { ...req("Google Ads ve Meta", "must", "skill", 0.5, [{ term: "Google Ads", synonyms: [] }, { term: "Meta", synonyms: [] }]), missingConcepts: ["Meta"] },
        { ...req("Özetinde geçen beceri", "must", "skill", 0.75), missingConcepts: [] },
      ],
      titleMatch: { level: "none", position: "Uzman" },
      scoringRevision: 3,
    })
    expect(parts[0]).toMatchObject({ type: "skill", missing: ["Meta"] })
    expect(parts[1]).toMatchObject({ type: "skill", missing: [] })
    expect(parts.at(-1)).toMatchObject({ type: "title", missing: [] })
  })
})

describe("groupParts", () => {
  const part = (label: string, credit: number, gain: number): ScorePart => ({ index: 0, label, kind: "must", type: "skill", missing: [label], weight: 2, credit, gain })

  it("counts a partial match as present, like the report's headline", () => {
    const { met, missing } = groupParts([part("Tam", 1, 0), part("Kısmi", 0.5, 6), part("Yok", 0, 12)])
    expect(met.map((p) => p.label)).toEqual(["Tam", "Kısmi"])
    expect(missing.map((p) => p.label)).toEqual(["Yok"])
  })

  it("puts the missing part worth the most points first", () => {
    const { missing } = groupParts([part("Az", 0, 6), part("Çok", 0, 12), part("Orta", 0, 9)])
    expect(missing.map((p) => p.label)).toEqual(["Çok", "Orta", "Az"])
  })

  it("puts full matches before partial ones", () => {
    const { met } = groupParts([part("Kısmi", 0.5, 6), part("Tam", 1, 0)])
    expect(met.map((p) => p.label)).toEqual(["Tam", "Kısmi"])
  })
})
