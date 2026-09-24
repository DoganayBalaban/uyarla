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
  /**
   * Kavram vektörleri, gereksinim sırasıyla düzleştirilmiş: önce birinci
   * gereksinimin kavramları, sonra ikincininkiler.
   *
   * Anlamsal eşleştirme gereksinim düzeyinden kavram düzeyine indi. Koca bir
   * gereksinim cümlesini bir CV maddesiyle karşılaştırmak fazla kabaydı ve
   * anlamsal katman hiçbir katkı yapmıyordu (K-15). Kavram düzeyinde
   * karşılaştırma hem keskin hem çapraz dilli eşleşmeyi taşıyor:
   * "version control" ile "Git ile versiyon kontrolü kullandım" buluşuyor.
   */
  conceptVectors: number[][]
}

/**
 * Bir ilanın tüm kavram metinlerini gereksinim sırasıyla düzleştirir.
 * Gömme çağrısı ve skorlama bu sırayı paylaşmak zorunda.
 */
export function conceptTexts(posting: JobPostingData): string[] {
  return posting.requirements.flatMap((r) => r.concepts.map((c) => c.term))
}

export interface RequirementResult {
  requirement: Requirement
  status: "matched" | "missing"
  /**
   * 0–1.
   *
   * Kelime eşleşmesinde **karşılanan kavram oranı**: dört kavram isteyen bir
   * gereksinimde biri bulunursa 0.25. Anlamsal eşleşmede benzerlik değeri.
   *
   * Oransal olmasının sebebi somut: ilanlar sık sık "Git ve CI/CD,
   * Microservices, Docker" gibi bileşik gereksinimler yazıyor ve yalnızca
   * Git bilen bir aday tam puan alıyordu (K-23).
   */
  confidence: number
  evidence: Evidence | null
  method: "keyword" | "semantic" | null
  /** Karşılanan kavramlar — kullanıcıya hangi kısmın tuttuğunu göstermek için. */
  matchedConcepts: string[]
  /** Karşılanmayan kavramlar; eksik listesi bunlardan üretiliyor. */
  missingConcepts: string[]
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
  // Kavram vektörleri düzleştirilmiş geliyor; her gereksinim kendi dilimini
  // alıyor.
  let imlec = 0
  const results: RequirementResult[] = input.posting.requirements.map((requirement) => {
    const dilim = input.conceptVectors.slice(imlec, imlec + requirement.concepts.length)
    imlec += requirement.concepts.length
    return matchRequirement(requirement, dilim, input, cfg)
  })

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
  // Kısmen karşılanan gereksinimlerin eksik kavramları da listeye giriyor:
  // kullanıcı "React'in var ama Docker'ın yok" bilgisini görmeli.
  const eksikKelimeler = [...new Set(results.flatMap((r) => r.missingConcepts))]

  return {
    score: toplamAgirlik === 0 ? 0 : Math.round((agirlikliToplam / toplamAgirlik) * 100),
    requirements: results,
    missingKeywords: eksikKelimeler,
  }
}

function matchRequirement(
  requirement: Requirement,
  conceptVectors: number[][],
  input: ScoreInput,
  cfg: ScoringConfig,
): RequirementResult {
  const karsilanan: string[] = []
  const karsilanmayan: string[] = []
  let ilkKanit: Evidence | null = null
  let kelimeVar = false
  let anlamsalVar = false

  // Karşılanan kavramların ağırlıklı toplamı. Tam kelime eşleşmesi kesindir
  // ve 1.0 katkı verir; anlamsal eşleşme bir tahmindir ve benzerlik değeri
  // kadar katkı verir. İkisine aynı ağırlığı vermek, tahmini kesinlik gibi
  // göstermek olurdu.
  let agirlik = 0

  for (const [i, concept] of requirement.concepts.entries()) {
    const aranacaklar = [concept.term, ...concept.synonyms]

    // 1. Tam kelime eşleşmesi.
    //
    // matchText kullanılıyor, text değil: text deneyim maddelerinde unvan ön
    // eki taşıyor ve unvana denk gelen bir kelime tüm maddelerle eşleşip
    // kanıt olarak rastgele birini seçtiriyordu (K-13).
    const kelimeKaniti = input.evidence.find((item) =>
      aranacaklar.some((terim) => containsKeyword(item.matchText, terim)),
    )
    if (kelimeKaniti) {
      karsilanan.push(concept.term)
      agirlik += 1
      ilkKanit ??= kelimeKaniti
      kelimeVar = true
      continue
    }

    // 2. Anlamsal eşleşme — kavram düzeyinde.
    const vektor = conceptVectors[i]
    if (vektor) {
      let enIyi: { similarity: number; evidence: Evidence } | null = null
      for (let j = 0; j < input.evidence.length; j++) {
        const kanitVektoru = input.evidenceVectors[j]
        const kanit = input.evidence[j]
        if (!kanitVektoru || !kanit) continue
        const benzerlik = cosineSimilarity(vektor, kanitVektoru)
        if (!enIyi || benzerlik > enIyi.similarity) {
          enIyi = { similarity: benzerlik, evidence: kanit }
        }
      }
      if (enIyi && enIyi.similarity >= cfg.semanticThreshold) {
        karsilanan.push(concept.term)
        agirlik += enIyi.similarity
        ilkKanit ??= enIyi.evidence
        anlamsalVar = true
        continue
      }
    }

    karsilanmayan.push(concept.term)
  }

  if (karsilanan.length === 0) {
    // Kanıt gösterilmiyor: eşiği geçmeyen en yakın maddeyi göstermek
    // kullanıcıya yanlış bir bağ kurdurur.
    return {
      requirement,
      status: "missing",
      confidence: 0,
      evidence: null,
      method: null,
      matchedConcepts: [],
      missingConcepts: karsilanmayan,
    }
  }

  return {
    requirement,
    status: "matched",
    // Güven, karşılanan kavramların ağırlıklı oranı: dört şey isteyen bir
    // gereksinimde birini bilen aday çeyrek puan alır (K-23). Anlamsal
    // eşleşmeler benzerlik değeri kadar katkı verir.
    confidence: agirlik / requirement.concepts.length,
    evidence: ilkKanit,
    method: kelimeVar ? "keyword" : anlamsalVar ? "semantic" : null,
    matchedConcepts: karsilanan,
    missingConcepts: karsilanmayan,
  }
}
