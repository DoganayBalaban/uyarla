import { cosineSimilarity } from "../llm/embedding.js"
import { containsKeyword } from "../normalize/turkish.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "./config.js"
import type { Evidence } from "./evidence.js"

export interface ScoreInput {
  profile: ResumeProfile
  posting: JobPostingData
  /** Kanıt birimleri; `evidenceVectors` ile aynı sırada. */
  evidence: Evidence[]
  evidenceVectors: number[][]
  /** `posting.requirements` ile aynı sırada. */
  requirementVectors: number[][]
}

export interface RequirementResult {
  requirement: Requirement
  status: "matched" | "missing"
  /** 0–1. Kelime eşleşmesinde 1, anlamsal eşleşmede benzerlik değeri. */
  confidence: number
  evidence: Evidence | null
  method: "keyword" | "semantic" | null
}

export interface ScoreResult {
  /** 0–100 arası tam sayı. */
  score: number
  requirements: RequirementResult[]
  /** Eksik gereksinimlerin anahtar kelimeleri; kullanıcıya gösterilen liste. */
  missingKeywords: string[]
}

/**
 * Üç aşamalı kanıt arama (spec §7):
 *   1. Tam kelime eşleşmesi → güven 1.0
 *   2. Anlamsal eşleşme, eşiği geçerse → güven = benzerlik
 *   3. Hiçbiri değilse → missing
 *
 * Saf fonksiyon: LLM çağırmaz, veritabanına dokunmaz. Bu yüzden birim testi
 * ucuz ve değerlendirme betiği doğrudan çağırabiliyor.
 *
 * Embedding skoru belirlemiyor, KANIT BULUYOR. Salt kosinüs benzerliği bir
 * sayı üretir ama eksik listesi üretemez — oysa ürünün sattığı şey o liste.
 */
export function score(
  input: ScoreInput,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreResult {
  const results: RequirementResult[] = input.posting.requirements.map(
    (requirement, i) => matchRequirement(requirement, i, input, cfg),
  )

  let agirlikliToplam = 0
  let toplamAgirlik = 0
  for (const result of results) {
    const agirlik =
      result.requirement.importance === "must" ? cfg.mustWeight : cfg.niceWeight
    toplamAgirlik += agirlik
    agirlikliToplam += agirlik * result.confidence
  }

  // Eksik kelimeler tekilleştiriliyor: aynı teknoloji birden çok gereksinimde
  // geçebiliyor ve kullanıcıya iki kez göstermenin anlamı yok.
  const eksikKelimeler = [
    ...new Set(
      results.filter((r) => r.status === "missing").flatMap((r) => r.requirement.keywords),
    ),
  ]

  return {
    score: toplamAgirlik === 0 ? 0 : Math.round((agirlikliToplam / toplamAgirlik) * 100),
    requirements: results,
    missingKeywords: eksikKelimeler,
  }
}

function matchRequirement(
  requirement: Requirement,
  index: number,
  input: ScoreInput,
  cfg: ScoringConfig,
): RequirementResult {
  // 1. Tam kelime eşleşmesi. Bulunduğunda vektörlere hiç bakılmaz:
  //    kanıt kesin, güven tam.
  // matchText kullanılıyor, text değil: text deneyim maddelerinde unvan ön eki
  // taşıyor ve unvana denk gelen bir anahtar kelime tüm maddelerle eşleşip
  // kanıt olarak rastgele birini seçtiriyordu.
  for (const item of input.evidence) {
    if (requirement.keywords.some((kw) => containsKeyword(item.matchText, kw))) {
      return {
        requirement,
        status: "matched",
        confidence: 1,
        evidence: item,
        method: "keyword",
      }
    }
  }

  // 2. Anlamsal eşleşme: en yakın kanıt aranır, eşiği geçerse kabul edilir.
  const reqVector = input.requirementVectors[index]
  if (reqVector) {
    let enIyi: { similarity: number; evidence: Evidence } | null = null
    for (let i = 0; i < input.evidence.length; i++) {
      const vector = input.evidenceVectors[i]
      const item = input.evidence[i]
      if (!vector || !item) continue
      const similarity = cosineSimilarity(reqVector, vector)
      if (!enIyi || similarity > enIyi.similarity) enIyi = { similarity, evidence: item }
    }

    if (enIyi && enIyi.similarity >= cfg.semanticThreshold) {
      return {
        requirement,
        status: "matched",
        confidence: enIyi.similarity,
        evidence: enIyi.evidence,
        method: "semantic",
      }
    }
  }

  // 3. Eksik. Kanıt gösterilmiyor: eşiği geçmeyen en yakın maddeyi göstermek
  //    kullanıcıya yanlış bir bağ kurdurur.
  return { requirement, status: "missing", confidence: 0, evidence: null, method: null }
}
