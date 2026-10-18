import type { Language } from "../normalize/language.js"
import { cosineSimilarity } from "../llm/vector.js"
import { containsKeyword } from "../normalize/turkish.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { DEFAULT_SCORING_CONFIG, SCORING_REVISION, type ScoringConfig } from "./config.js"
import { experienceMonths, requiredYears } from "./duration.js"
import type { Evidence } from "./evidence.js"
import type { CorrectedRequirement, ExclusionMark, RequirementCorrection, RequirementReport } from "./exclusions.js"
import { titleMatch, type TitleMatch } from "./title.js"

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
  /** "halen" ve deneyim süresi hesabı için bugün; testte sabitleniyor. */
  now?: Date
}

/**
 * Bir ilanın tüm kavram metinlerini gereksinim sırasıyla düzleştirir.
 * Gömme çağrısı ve skorlama bu sırayı paylaşmak zorunda.
 *
 * CV ile ilan farklı dildeyse gömülen metin terim ve eş anlamlıları birlikte
 * (DOG-104): "kişisel veri
 * koruma (personal data protection; personal data privacy)". Karşı dil
 * karşılıkları (DOG-73) kelime eşleşmesinde kullanılıyordu ama anlamsal
 * katman yalnızca Türkçe terimi görüyordu; İngilizce CV'deki "privacy…
 * PII/KVKK masking" maddesi 0,47'de eşiğin altında kalıyordu.
 */
export function conceptTexts(posting: JobPostingData, resumeLanguage?: Language): string[] {
  // Yalnızca diller farklıysa: aynı dilde İngilizce karşılık eklemek Türkçe
  // terimin vektörünü bulandırıp doğru eşleşmeleri eşiğin altına itiyordu
  // (ölçüm: kaçırma 6 → 8).
  const crossLanguage = resumeLanguage !== undefined && resumeLanguage !== posting.language
  return posting.requirements.flatMap((r) =>
    r.concepts.map((c) => (crossLanguage ? conceptEmbeddingText(c) : c.term)),
  )
}

const MAX_EMBEDDED_SYNONYMS = 3

function conceptEmbeddingText(concept: { term: string; synonyms: string[] }): string {
  const term = concept.term.trim()
  const extra = [...new Set(concept.synonyms.map((s) => s.trim()))]
    .filter((s) => s && s.toLocaleLowerCase("tr") !== term.toLocaleLowerCase("tr"))
    .slice(0, MAX_EMBEDDED_SYNONYMS)
  return extra.length ? `${term} (${extra.join("; ")})` : term
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
  /**
   * İlan unvanı CV'de geçiyor mu (DOG-87). Skorda bir zorunlu gereksinim
   * ağırlığında (DOG-103). Bu alandan önce kaydedilmiş analizlerde yok;
   * ilanda unvan yoksa null.
   */
  titleMatch?: TitleMatch | null
  /** Skor formülünün sürümü (SCORING_REVISION); eski analizlerde yok (= 1). */
  scoringRevision?: number
  /**
   * Kullanıcının "ilanda yok, yanlış okunmuş" diye işaretlediği gereksinimlerin
   * `requirements` içindeki sırası (DOG-90). Analizin kendi skoru değişmiyor;
   * ekran düzeltilmiş skoru weightedScore'un web'deki eşiyle hesaplıyor.
   */
  excluded?: number[]
  /** İşaretlerin nedeni ve kapsamı, `requirements` sırasıyla (DOG-90). */
  exclusions?: Record<number, ExclusionMark>
  /** Hariç tutmayan "CV'mde var" bildirimleri (DOG-90). */
  reports?: RequirementReport[]
  /**
   * Kullanıcının düzelttiği şartlar (DOG-90). Varsa `requirements` düzeltilmiş
   * ilanla yeniden hesaplanmış; `score` yine ilk skor.
   */
  corrections?: Record<number, RequirementCorrection>
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
    return checkDuration(matchRequirement(requirement, vectorSlice, input, cfg), input)
  })


  // Eksik kelimeler tekilleştiriliyor: aynı teknoloji birden çok gereksinimde
  // geçebiliyor ve kullanıcıya iki kez göstermenin anlamı yok.
  // Kısmen karşılanan gereksinimlerin eksik kavramları da listeye giriyor:
  // kullanıcı "React'in var ama Docker'ın yok" bilgisini görmeli.
  const missingWords = [...new Set(results.flatMap((r) => r.missingConcepts))]

  const title = titleMatch(input.posting.position, input.profile)
  return {
    score: weightedScore(results, cfg, [], title),
    requirements: results,
    missingKeywords: missingWords,
    titleMatch: title,
    scoringRevision: SCORING_REVISION,
  }
}

/**
 * Gereksinim sonuçlarından 0–100 skor: zorunlular ve tercih sebepleri kendi
 * ağırlıklarıyla, güven oranında.
 *
 * `excluded`: kullanıcının "ilanda yok, yanlış okunmuş" diye işaretlediği
 * gereksinimlerin sırası (DOG-90). Paydadan da çıkıyorlar; yanlış okunan bir
 * gereksinim ne eksik ne karşılanmış sayılmalı. Hepsi çıkarılırsa 0.
 */
export function weightedScore(
  results: Pick<RequirementResult, "requirement" | "confidence">[],
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
  excluded: readonly number[] = [],
  title: Pick<TitleMatch, "level"> | null = null,
): number {
  const skip = new Set(excluded)
  const counted = results.filter((_, i) => !skip.has(i))
  // Kişisel nitelikler skora girmiyor; ilanda yalnızca onlar varsa giriyor.
  const scored = counted.filter((r) => !cfg.unscoredTypes.includes(r.requirement.type))
  const pool = scored.length > 0 ? scored : counted
  if (pool.length === 0) return 0

  let weightedSum = 0
  let totalWeight = 0
  for (const result of pool) {
    const weight = result.requirement.importance === "must" ? cfg.mustWeight : cfg.niceWeight
    totalWeight += weight
    weightedSum += weight * result.confidence
  }
  // Unvan bir zorunlu gereksinim gibi (DOG-103). Bu alandan önceki
  // analizlerde ve unvansız ilanlarda yok.
  if (title) {
    totalWeight += cfg.titleWeight
    weightedSum += cfg.titleWeight * TITLE_CREDIT[title.level]
  }
  return Math.round((weightedSum / totalWeight) * 100)
}

const TITLE_CREDIT: Record<TitleMatch["level"], number> = { exact: 1, partial: 0.5, none: 0 }

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
  const summarySemantic = cfg.summarySemanticTypes.includes(requirement.type)

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
    const keywordEvidence =
      eligibleEvidence.find((item) =>
        searchTerms.some((termText) => containsKeyword(item.evidence.matchText, termText)),
      )?.evidence ?? relatedFieldEvidence(requirement, searchTerms, eligibleEvidence)
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
        if (ev.kind === "summary" && !summarySemantic) continue
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

/**
 * "En az 2 yıl …" gibi süre şartı (DOG-75). Kavram bulunsa bile ilgili
 * rollerin toplam süresi yetmiyorsa gereksinim karşılanmamış sayılıyor.
 *
 * İlgili roller, gereksinimin kavramları unvanında ya da maddelerinde geçen
 * roller: 10 yıl muhasebe ve 1 yıl test deneyimi olan aday "2 yıl test"
 * şartını karşılamaz. Hiçbir rolde geçmiyorsa (kavram beceri listesinden
 * bulunduysa) toplam deneyime bakılıyor.
 *
 * Tarihler okunamıyorsa karar değişmiyor: bilmediğimiz bir süre için
 * "eksik" demek, kanıtsız "var" demek kadar yanlış olurdu.
 *
 * Süre metni eksik listesine ekleniyor ama kavram değil: uyarlama yalnızca
 * kavram adlarını hedef alıyor (adapt/targets.ts), CV'ye süre yazdırılamaz.
 */
function checkDuration(result: RequirementResult, input: ScoreInput): RequirementResult {
  if (result.status !== "matched") return result
  // Kullanıcının düzelttiği yıl (DOG-90) ilan metninden okunanın yerine geçiyor.
  const years = (result.requirement as CorrectedRequirement).minYears ?? requiredYears(result.requirement.text)
  if (years === null) return result

  const now = input.now ?? new Date()
  const roles = input.profile.experience
  const terms = result.requirement.concepts.flatMap((c) => [c.term, ...c.synonyms])
  const relevant = roles.filter((role) => {
    const text = [role.title, ...role.bullets.map((b) => b.text)].join("\n")
    return terms.some((t) => containsKeyword(text, t))
  })
  const months = experienceMonths(relevant.length > 0 ? relevant : roles, now)
  if (months === null || months >= years * 12) return result

  const have = (Math.round((months / 12) * 10) / 10).toLocaleString(input.posting.language === "en" ? "en" : "tr")
  const note =
    input.posting.language === "en"
      ? `${years}+ years of experience (CV: ~${have} years)`
      : `En az ${years} yıl deneyim (CV'de ~${have} yıl)`
  return {
    ...result,
    status: "missing",
    confidence: 0,
    evidence: null,
    method: null,
    missingConcepts: [...result.missingConcepts, note],
  }
}

/** İlanın yakın bölümleri de kabul ettiğini söyleyen ifade. */
const RELATED_FIELD = /\b(ilgili|related|benzer|yakın)\b/iu

/** Bölüm adının önündeki, alana ait olmayan kalıp. */
const FIELD_PREFIX =
  /^((üniversitelerin|üniversitenin|tercihen|preferably)\s+)*(bachelor'?s?(\s+degree)?\s+in\s+|degree\s+in\s+|b\.?\s?sc?\.?\s+in\s+)?/iu

/** Bölüm adının sonundaki genel kelimeler; geriye alanın kendisi kalıyor. */
const FIELD_TAIL =
  /\s+(mühendisliği|mühendislik|bölümü|bölümleri|bilimleri|bilimi|fakültesi|engineering|science|sciences|studies|department)$/iu

/**
 * "Bilgisayar Mühendisliği veya ilgili bölümlerden mezun" (DOG-75): ilan yakın
 * bölümleri de kabul ediyor. Bölüm adının çekirdeği ("Bilgisayar"; karşılığı
 * "Computer Engineering"den "Computer") CV'nin eğitim satırında geçiyorsa
 * şart karşılanıyor: "Computer and Information Science".
 *
 * Yalnızca eğitim kanıtına bakılıyor; çekirdek kelime bir deneyim maddesinde
 * ("bilgisayar donanımı kurulumu") geçerse bölüm olmaz.
 */
function relatedFieldEvidence(
  requirement: Requirement,
  searchTerms: string[],
  eligibleEvidence: Array<{ evidence: Evidence }>,
): Evidence | undefined {
  if (requirement.type !== "education" || !RELATED_FIELD.test(requirement.text)) return undefined
  const heads = searchTerms
    .map((t) => t.replace(FIELD_PREFIX, "").replace(FIELD_TAIL, "").trim())
    .filter((h, i) => h !== searchTerms[i] && h.length >= 3)
  if (heads.length === 0) return undefined
  return eligibleEvidence.find(
    (item) => item.evidence.kind === "education" && heads.some((h) => containsKeyword(item.evidence.matchText, h)),
  )?.evidence
}
