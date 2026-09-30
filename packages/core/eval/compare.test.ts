import { describe, it, expect } from "vitest"
import { compareToExpectations } from "./compare.js"
import type { ScoreResult } from "../src/score/score.js"

const outcome = (
  rows: Array<{
    text: string
    status: "matched" | "missing"
    evidence?: string
    method?: "keyword" | "semantic"
  }>,
): ScoreResult => ({
  score: 50,
  missingKeywords: [],
  requirements: rows.map((s) => ({
    requirement: { text: s.text, type: "skill", importance: "must", concepts: [] },
    status: s.status,
    confidence: s.status === "matched" ? 1 : 0,
    method: s.status === "matched" ? (s.method ?? "keyword") : null,
    evidence: s.evidence
      ? { text: s.evidence, matchText: s.evidence, kind: "bullet" as const, sourceRef: null }
      : null,
    matchedConcepts: [],
    missingConcepts: [],
  })),
})

describe("compareToExpectations", () => {
  it("counts a correct classification as a hit", () => {
    const m = compareToExpectations(
      "p1",
      outcome([{ text: "React deneyimi", status: "matched", evidence: "React ile panel" }]),
      [{ match: "React", shouldMatch: true, evidenceContains: "React ile panel" }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.misses).toBe(0)
    expect(m.fabrications).toBe(0)
  })

  it("also counts a correctly missing requirement as a hit", () => {
    const m = compareToExpectations(
      "p1",
      outcome([{ text: "Kubernetes", status: "missing" }]),
      [{ match: "Kubernetes", shouldMatch: false }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.fabrications).toBe(0)
  })

  it("counts a requirement with evidence reported as missing as a miss", () => {
    const m = compareToExpectations(
      "p1",
      outcome([{ text: "React deneyimi", status: "missing" }]),
      [{ match: "React", shouldMatch: true }],
      1000,
    )
    expect(m.misses).toBe(1)
  })

  it("counts a requirement without evidence reported as matched as a fabrication", () => {
    const m = compareToExpectations(
      "p1",
      outcome([{ text: "Kubernetes", status: "matched", evidence: "React ile panel" }]),
      [{ match: "Kubernetes", shouldMatch: false }],
      1000,
    )
    expect(m.fabrications).toBe(1)
  })

  it("counts showing the wrong evidence as a miss", () => {
    // Doğru sonuç ama yanlış gerekçe; kullanıcıya yanlış bağ kurdurur.
    const m = compareToExpectations(
      "p1",
      outcome([{ text: "React deneyimi", status: "matched", evidence: "Muhasebe süreçleri" }]),
      [{ match: "React", shouldMatch: true, evidenceContains: "React ile panel" }],
      1000,
    )
    expect(m.hits).toBe(0)
    expect(m.misses).toBe(1)
  })

  it("counts a requirement never produced by posting extraction separately", () => {
    // Sorun skorda değil çıkarımda; ayrı sayılmazsa yanlış yere bakılır.
    const m = compareToExpectations("p1", outcome([]), [{ match: "React", shouldMatch: true }], 1000)
    expect(m.notExtracted).toBe(1)
    expect(m.hits).toBe(0)
    expect(m.misses).toBe(0)
  })

  it("counts which stage matches came from", () => {
    const m = compareToExpectations(
      "p1",
      outcome([
        { text: "React", status: "matched", method: "keyword" },
        { text: "Takım çalışması", status: "matched", method: "semantic" },
      ]),
      [
        { match: "React", shouldMatch: true },
        { match: "Takım", shouldMatch: true },
      ],
      1000,
    )
    expect(m.byKeyword).toBe(1)
    expect(m.bySemantic).toBe(1)
  })

  it("matches requirement text despite case and suffix differences", () => {
    const m = compareToExpectations(
      "p1",
      outcome([{ text: "En az 3 yıl REACT deneyimi", status: "matched", evidence: "react" }]),
      [{ match: "react deneyim", shouldMatch: true }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.notExtracted).toBe(0)
  })
})
