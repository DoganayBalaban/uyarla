import { describe, it, expect } from "vitest"
import { compareToExpectations } from "./compare.js"
import type { ScoreResult } from "../src/score/score.js"

const sonuc = (
  satirlar: Array<{
    text: string
    status: "matched" | "missing"
    evidence?: string
    method?: "keyword" | "semantic"
  }>,
): ScoreResult => ({
  score: 50,
  missingKeywords: [],
  requirements: satirlar.map((s) => ({
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
  it("doğru sınıflandırmayı isabet sayar", () => {
    const m = compareToExpectations(
      "p1",
      sonuc([{ text: "React deneyimi", status: "matched", evidence: "React ile panel" }]),
      [{ match: "React", shouldMatch: true, evidenceContains: "React ile panel" }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.misses).toBe(0)
    expect(m.fabrications).toBe(0)
  })

  it("doğru şekilde eksik denen gereksinimi de isabet sayar", () => {
    const m = compareToExpectations(
      "p1",
      sonuc([{ text: "Kubernetes", status: "missing" }]),
      [{ match: "Kubernetes", shouldMatch: false }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.fabrications).toBe(0)
  })

  it("kanıtı olan gereksinimin missing denmesini kaçırma sayar", () => {
    const m = compareToExpectations(
      "p1",
      sonuc([{ text: "React deneyimi", status: "missing" }]),
      [{ match: "React", shouldMatch: true }],
      1000,
    )
    expect(m.misses).toBe(1)
  })

  it("kanıtı olmayan gereksinimin matched denmesini uydurma sayar", () => {
    const m = compareToExpectations(
      "p1",
      sonuc([{ text: "Kubernetes", status: "matched", evidence: "React ile panel" }]),
      [{ match: "Kubernetes", shouldMatch: false }],
      1000,
    )
    expect(m.fabrications).toBe(1)
  })

  it("yanlış kanıt gösterilmesini kaçırma sayar", () => {
    // Doğru sonuç ama yanlış gerekçe; kullanıcıya yanlış bağ kurdurur.
    const m = compareToExpectations(
      "p1",
      sonuc([{ text: "React deneyimi", status: "matched", evidence: "Muhasebe süreçleri" }]),
      [{ match: "React", shouldMatch: true, evidenceContains: "React ile panel" }],
      1000,
    )
    expect(m.hits).toBe(0)
    expect(m.misses).toBe(1)
  })

  it("ilan çıkarımının hiç üretmediği gereksinimi ayrı sayar", () => {
    // Sorun skorda değil çıkarımda; ayrı sayılmazsa yanlış yere bakılır.
    const m = compareToExpectations("p1", sonuc([]), [{ match: "React", shouldMatch: true }], 1000)
    expect(m.notExtracted).toBe(1)
    expect(m.hits).toBe(0)
    expect(m.misses).toBe(0)
  })

  it("eşleşmelerin hangi aşamadan geldiğini sayar", () => {
    const m = compareToExpectations(
      "p1",
      sonuc([
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

  it("gereksinim metnini büyük/küçük harf ve ek farkına rağmen eşler", () => {
    const m = compareToExpectations(
      "p1",
      sonuc([{ text: "En az 3 yıl REACT deneyimi", status: "matched", evidence: "react" }]),
      [{ match: "react deneyim", shouldMatch: true }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.notExtracted).toBe(0)
  })
})
