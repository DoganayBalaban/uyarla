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
  let cursor = 0
  const results: RequirementResult[] = input.posting.requirements.map((requirement) => {
    const vectorSlice = input.conceptVectors.slice(cursor, cursor + requirement.concepts.length)
    cursor += requirement.concepts.length
    return matchRequirement(requirement, vectorSlice, input, cfg)
  })

  let weightedSum = 0
  let totalWeight = 0
  for (const result of results) {
    const weight =
      result.requirement.importance === "must" ? cfg.mustWeight : cfg.niceWeight
    totalWeight += weight
    weightedSum += weight * result.confidence
  }

  // Eksik kelimeler tekilleştiriliyor: aynı teknoloji birden çok gereksinimde
  // geçebiliyor ve kullanıcıya iki kez göstermenin anlamı yok.
  // Kısmen karşılanan gereksinimlerin eksik kavramları da listeye giriyor:
  // kullanıcı "React'in var ama Docker'ın yok" bilgisini görmeli.
  const missingWords = [...new Set(results.flatMap((r) => r.missingConcepts))]

  return {
    score: totalWeight === 0 ? 0 : Math.round((weightedSum / totalWeight) * 100),
    requirements: results,
    missingKeywords: missingWords,
  }
}

/**
 * Kavram bir özel ad mı: teknoloji, ürün, marka. Her kelimesi büyük harfle
 * başlıyor ya da rakam/simge taşıyorsa ("GraphQL", "CI/CD", "Next.js",
 * "Google Analytics 4", "Docker") evet; içinde küçük harfle başlayan bir
 * kelime varsa ("Web performansı", "birim testleri") hayır. Eş anlamlıların
 * da hepsi özel ad olmalı: "erişilebilirlik (WCAG)" gibi bir kavram anlamsal
 * eşleşmeye açık kalıyor.
 */
export function isProperNoun(concept: { term: string; synonyms: string[] }): boolean {
  const name = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0 || words.length > 3) return false
    // Güçlü işaret taşıyan tek bir kelime yeter: simge, rakam ya da birden
    // çok büyük harf ("A/B testleri", "SQL sorguları", "TikTok reklamları").
    // Uçtan uca testte "A/B testleri" beceri listesindeki "İçerik
    // Pazarlaması"yla anlamca eşleşmişti (K-38).
    if (words.some((k) => /[\p{N}/#+]/u.test(k) || /\p{Lu}.*\p{Lu}/u.test(k))) return true
    // Yalnızca baş harfi büyük kelimelerden oluşan ifade Türkçe harf
    // taşıyorsa özel ad değil, başlık düzeninde yazılmış bir alan adıdır:
    // "Yazılım Mühendisliği" ↔ "Yazılım Geliştirme" değerlendirme setindeki
    // meşru anlamsal eşleşmelerden biri (K-37) ve açık kalmalı.
    if (/[çğıöşüÇĞİÖŞÜ]/u.test(text)) return false
    return words.every((k) => /^[\p{Lu}\p{N}]/u.test(k) || /[.]/u.test(k))
  }
  return [concept.term, ...concept.synonyms].every(name)
}

/** Kanıt türünün katkı çarpanı; yalnızca özet indirimli (bkz. summaryWeight). */
function evidenceMultiplier(ev: Evidence, cfg: ScoringConfig): number {
  return ev.kind === "summary" ? cfg.summaryWeight : 1
}

function matchRequirement(
  requirement: Requirement,
  conceptVectors: number[][],
  input: ScoreInput,
  cfg: ScoringConfig,
): RequirementResult {
  const satisfied: string[] = []
  const unsatisfied: string[] = []
  let firstEvidence: Evidence | null = null
  let hasWord = false
  let hasSemantic = false

  // Gereksinimin türü, onu karşılayabilecek kanıtın türünü sınırlıyor.
  // Filtreleme burada yapılıyor ki hem kelime hem anlamsal aşama aynı kanıt
  // kümesine baksın: kısıt yalnızca anlamsal katmana konsaydı aynı uydurma
  // kelime eşleşmesiyle geri gelirdi (K-36).
  //
  // Vektör kanıtla aynı nesnede taşınıyor; ayrı diziyi index'le eşlemek
  // filtreden sonra kayardı.
  const allowedKinds = cfg.evidenceKindsByType[requirement.type]
  const eligibleEvidence: Array<{ evidence: Evidence; vector: number[] | undefined }> = []
  for (const [j, ev] of input.evidence.entries()) {
    if (!allowedKinds.includes(ev.kind)) continue
    eligibleEvidence.push({ evidence: ev, vector: input.evidenceVectors[j] })
  }

  const semanticEnabled = cfg.semanticTypes.includes(requirement.type)

  // Karşılanan kavramların ağırlıklı toplamı. Tam kelime eşleşmesi kesindir
  // ve 1.0 katkı verir; anlamsal eşleşme bir tahmindir ve benzerlik değeri
  // kadar katkı verir. İkisine aynı ağırlığı vermek, tahmini kesinlik gibi
  // göstermek olurdu.
  let weight = 0

  for (const [i, concept] of requirement.concepts.entries()) {
    const searchTerms = [concept.term, ...concept.synonyms]

    // 1. Tam kelime eşleşmesi.
    //
    // matchText kullanılıyor, text değil: text deneyim maddelerinde unvan ön
    // eki taşıyor ve unvana denk gelen bir kelime tüm maddelerle eşleşip
    // kanıt olarak rastgele birini seçtiriyordu (K-13).
    //
    // Kanıtlar tam ağırlıklılar önde olacak şekilde sıralı (özet sonda), yani
    // ilk bulunan aynı zamanda en güçlü olanı.
    const keywordEvidence = eligibleEvidence.find((item) =>
      searchTerms.some((termText) => containsKeyword(item.evidence.matchText, termText)),
    )?.evidence
    if (keywordEvidence) {
      satisfied.push(concept.term)
      weight += evidenceMultiplier(keywordEvidence, cfg)
      firstEvidence ??= keywordEvidence
      hasWord = true
      continue
    }

    // 2. Anlamsal eşleşme — kavram düzeyinde.
    //
    // Eşik ham benzerliğe uygulanıyor, sıralama ise katkıya (benzerlik ×
    // kanıt çarpanı): eşiği geçen bir madde, biraz daha benzer bir özet
    // cümlesine tercih ediliyor.
    //
    // Özel adlarda (teknoloji, ürün, marka) anlamsal eşleşme kapalı: böyle bir
    // ad CV'de ya geçer ya geçmez. Gömme uzayı teknoloji adlarını birbirine
    // yakın koyuyor ve uçtan uca testte "GraphQL" beceri listesindeki
    // "Next.js" ile (0,74), "CI/CD" de "Git" ile (0,71) eşleşti; ikisi de
    // CV'de olmayan yetkinlikti (K-38, birikmiş işler #15 seçenek 3).
    const vec = conceptVectors[i]
    if (vec && semanticEnabled && !isProperNoun(concept)) {
      let best: { similarity: number; contribution: number; evidence: Evidence } | null = null
      for (const { evidence: ev, vector: evidenceVector } of eligibleEvidence) {
        if (!evidenceVector) continue
        const similarityScore = cosineSimilarity(vec, evidenceVector)
        if (similarityScore < cfg.semanticThreshold) continue
        const contribution = similarityScore * evidenceMultiplier(ev, cfg)
        if (!best || contribution > best.contribution) {
          best = { similarity: similarityScore, contribution, evidence: ev }
        }
      }
      if (best) {
        satisfied.push(concept.term)
        weight += best.contribution
        firstEvidence ??= best.evidence
        hasSemantic = true
        continue
      }
    }

    unsatisfied.push(concept.term)
  }

  if (satisfied.length === 0) {
    // Kanıt gösterilmiyor: eşiği geçmeyen en yakın maddeyi göstermek
    // kullanıcıya yanlış bir bağ kurdurur.
    return {
      requirement,
      status: "missing",
      confidence: 0,
      evidence: null,
      method: null,
      matchedConcepts: [],
      missingConcepts: unsatisfied,
    }
  }

  return {
    requirement,
    status: "matched",
    // Güven, karşılanan kavramların ağırlıklı oranı: dört şey isteyen bir
    // gereksinimde birini bilen aday çeyrek puan alır (K-23). Anlamsal
    // eşleşmeler benzerlik değeri kadar katkı verir.
    confidence: weight / requirement.concepts.length,
    evidence: firstEvidence,
    method: hasWord ? "keyword" : hasSemantic ? "semantic" : null,
    matchedConcepts: satisfied,
    missingConcepts: unsatisfied,
  }
}
