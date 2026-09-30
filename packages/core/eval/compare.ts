import { normalizeText } from "../src/normalize/turkish.js"
import type { ScoreResult } from "../src/score/score.js"
import type { ExpectedRequirement, PairMetrics } from "./types.js"

/**
 * Beklentileri sonuçla karşılaştırır.
 *
 * Skor rakamı karşılaştırılmıyor — "bu çift 72 almalı" diye bir gerçek yok ve
 * ağırlıklar her ayarlandığında beklenti dosyalarını güncellemek gerekirdi.
 * Ölçülen şey **eşleştirme isabeti**: skor bundan türeyen bir sayı, kalite
 * sinyali eşleştirmenin kendisinde (spec §10).
 */
export function compareToExpectations(
  id: string,
  result: ScoreResult,
  expectations: ExpectedRequirement[],
  durationMs: number,
): PairMetrics {
  let hits = 0
  let misses = 0
  let fabrications = 0
  let notExtracted = 0
  let byKeyword = 0
  let bySemantic = 0

  for (const expected of expectations) {
    const searched = normalizeText(expected.match)
    const actual = result.requirements.find((r) =>
      normalizeText(r.requirement.text).includes(searched),
    )

    // İlan çıkarımı bu gereksinimi hiç üretmemiş: sorun skorda değil
    // çıkarımda. Ayrı sayılmazsa yanlış yere bakılır.
    if (!actual) {
      notExtracted++
      continue
    }

    const matched = actual.status === "matched"
    if (matched) {
      if (actual.method === "keyword") byKeyword++
      if (actual.method === "semantic") bySemantic++
    }

    if (expected.shouldMatch && matched) {
      // Kanıt beklendiyse doğru maddeyi göstermiş olmalı: doğru sonuç ama
      // yanlış gerekçe, kullanıcıya yanlış bağ kurdurur.
      const evidenceCorrect =
        !expected.evidenceContains ||
        normalizeText(actual.evidence?.text ?? "").includes(
          normalizeText(expected.evidenceContains),
        )
      if (evidenceCorrect) hits++
      else misses++
    } else if (expected.shouldMatch && !matched) {
      misses++
    } else if (!expected.shouldMatch && matched) {
      fabrications++
    } else {
      hits++
    }
  }

  return {
    id,
    hits,
    misses,
    fabrications,
    notExtracted,
    score: result.score,
    durationMs,
    byKeyword,
    bySemantic,
  }
}
