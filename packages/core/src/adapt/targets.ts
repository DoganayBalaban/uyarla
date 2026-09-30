import { cosineSimilarity } from "../llm/embedding.js"
import { containsKeyword, normalizeTokens } from "../normalize/turkish.js"
import type { Concept, JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { isProperNoun as isProperNoun, type ScoreResult } from "../score/score.js"

/**
 * Terim uyumu (K-38).
 *
 * İlk tasarım madde yazımına ilanı hiç vermiyordu, çünkü verildiğinde model
 * ilan terimlerini CV'de karşılığı olmadan maddelere sokuyordu (K-29). Bunun
 * bedeli ağırdı: yazım bir eşleşme kazandıramıyor, skor hiç değişmiyordu ve
 * değişiklikler "ile → kullanarak" düzeyinde kalıyordu.
 *
 * Şimdi modele yalnızca o maddeye anlamca yakın, henüz karşılanmamış ilan
 * terimleri veriliyor ve model kullandığı her terim için maddeden birebir bir
 * dayanak göstermek zorunda. Dayanak kodda doğrulanıyor (verify/alignment.ts);
 * doğrulanamayan terim eskisi gibi uydurma uyarısı alıyor.
 */

export interface AlignmentTarget {
  /** Modele gösterilen biçim: "sunucu tarafı render (SSR)". */
  label: string
  concept: Concept
}

export interface TargetOptions {
  /** Madde ile kavram arasındaki en düşük benzerlik. */
  minSimilarity: number
  /** Madde başına en fazla hedef; modele ne kadar az verilirse o kadar az uydurur. */
  maxPerBullet: number
}

/**
 * Uçtan uca ölçümde (qwen3-embedding) maddeye gerçekten yakın betimleyici
 * kavramlar 0,49–0,50 bandında, zayıf ilgililer 0,40 civarındaydı. Gömme
 * modeline bağlı bir değer: BGE-M3 ile yeniden ölçülmeli.
 */
export const DEFAULT_TARGET_OPTIONS: TargetOptions = {
  minSimilarity: 0.45,
  maxPerBullet: 2,
}

/**
 * Skoru yükseltebilecek kavramlar: hiç karşılanmamışlar ve yalnızca anlamsal
 * benzerlikle (kelime eşleşmesi olmadan) karşılananlar. Kelimesi zaten
 * CV'de geçen kavramı bir maddeye daha yazmak skoru değiştirmez.
 */
export function openConcepts(
  posting: JobPostingData,
  result: ScoreResult,
): Array<{ concept: Concept; index: number }> {
  const openItems: Array<{ concept: Concept; index: number }> = []
  let index = 0
  posting.requirements.forEach((req, r) => {
    const outcome = result.requirements[r]
    // Eğitim şartı bir deneyim maddesine yazılarak karşılanamaz: model
    // "öğrencilerin bilgisayar mühendisliği proje süreçlerine destek
    // sağladım" gibi bir bölüm uyduruyordu (eval:adapt, cv-c).
    if (req.type === "education") {
      index += req.concepts.length
      return
    }
    for (const concept of req.concepts) {
      const missing = outcome?.missingConcepts.includes(concept.term) ?? true
      const semanticOnly = outcome?.method === "semantic"
      if (missing || semanticOnly) openItems.push({ concept, index })
      index++
    }
  })
  return openItems
}

/**
 * Her madde için hedef terimleri seçer.
 *
 * `conceptVectors` `conceptTexts(posting)` sırasıyla düzleştirilmiş olmalı
 * (skorlamayla aynı sıra).
 */
export function alignmentTargets(
  input: {
    bullets: string[]
    bulletVectors: number[][]
    posting: JobPostingData
    conceptVectors: number[][]
    result: ScoreResult
  },
  opts: TargetOptions = DEFAULT_TARGET_OPTIONS,
): AlignmentTarget[][] {
  const openItems = openConcepts(input.posting, input.result)
    // Özel adlar (GraphQL, Docker, Storybook) hedef olamaz: bir teknolojiyi
    // kullanıp kullanmadığın yeniden ifadeyle değişmez. Gömme benzerliği
    // bunu ayırt edemiyor; ölçümde "GraphQL" ile "REST API'lerle
    // entegrasyon" 0,64 çıktı, "SSR" ile "sunucu tarafı render" 0,54 (K-38).
    .filter(({ concept }) => !isProperNoun(concept))

  // Her kavram yalnızca ona en yakın maddeye veriliyor. Aynı terimi birden
  // çok maddeye yazdırmak skora bir şey katmıyor, zorlama cümle üretiyordu
  // ("…ürün sayfalarını geliştirerek web performansı sağladım").
  const candidates: Array<{ bulletItem: number; concept: Concept; similarityScore: number }> = []
  for (const { concept, index } of openItems) {
    const v = input.conceptVectors[index]
    if (!v) continue
    let best: { bulletItem: number; similarityScore: number } | null = null
    input.bullets.forEach((bulletItem, i) => {
      const mv = input.bulletVectors[i]
      if (!mv || mentionsConcept(bulletItem, concept)) return
      // Tüm madde ile kısa bir kavramı karşılaştırınca gömme sinyali
      // sulanıyor: "Bütçe yönetimi" ile "aylık 150.000 TL bütçeyi optimize
      // ettim" yalnızca 0,42 çıktı. Kavramın bir içerik kelimesi maddede
      // (kök düzeyinde) geçiyorsa aday güçlenir; bu sinyal gömme modelinden
      // bağımsız (K-38).
      const similarityScore = cosineSimilarity(mv, v) + (sharesWord(bulletItem, concept.term) ? KEYWORD_BONUS : 0)
      if (!best || similarityScore > best.similarityScore) best = { bulletItem: i, similarityScore }
    })
    const selected = best as { bulletItem: number; similarityScore: number } | null
    if (selected && selected.similarityScore >= opts.minSimilarity) candidates.push({ concept, ...selected })
  }

  return input.bullets.map((_, i) =>
    candidates
      .filter((a) => a.bulletItem === i)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, opts.maxPerBullet)
      .map(({ concept }) => ({ label: headingLabel(concept), concept })),
  )
}

const KEYWORD_BONUS = 0.1

/**
 * Kavramın en az dört harfli bir kökü maddede geçiyor mu. Önek eşleşmesi:
 * kaynaştırma harfi kökte kalabiliyor ("bütçeyi" → "bütçey", "bütçe" →
 * "bütçe").
 */
function sharesWord(bulletItem: string, termText: string): boolean {
  const bulletStems = normalizeTokens(bulletItem)
  return normalizeTokens(termText).some(
    (k) => k.length >= 4 && bulletStems.some((m) => m.startsWith(k) || (m.length >= 4 && k.startsWith(m))),
  )
}

/** Kavramın terimi ya da eş anlamlılarından biri metinde geçiyor mu. */
export function mentionsConcept(content: string, concept: Concept): boolean {
  return [concept.term, ...concept.synonyms].some((t) => containsKeyword(content, t))
}

function headingLabel(concept: Concept): string {
  const term = naturalSpelling(concept.term)
  // Seçenek grubunun terimi zaten üyelerini sayıyor: "Jest / Cypress".
  if (concept.term.includes(" / ") || concept.synonyms.length === 0) return term
  return `${term} (${concept.synonyms.join(", ")})`
}

/**
 * Betimleyici terim cümle içinde küçük harfle başlar. İlandaki madde başı
 * büyük harfi ("Bütçe yönetimi") modele olduğu gibi gidince yazım cümle
 * ortasında büyük harf taşıyordu (K-38). Özel adlara dokunulmuyor.
 */
export function naturalSpelling(term: string): string {
  if (isProperNoun({ term, synonyms: [] })) return term
  const [first, ...rest] = [...term]
  return first ? first.toLocaleLowerCase("tr") + rest.join("") : term
}

/**
 * CV'nin tüm metni: özet yazımı ve beceri eklemesi bunu kaynak sayıyor.
 * Özet artık yalnızca kendi metnine değil, CV'nin tamamına dayanabilir;
 * örneğin maddelerde geçen "Next.js" özette öne çıkarılabilir.
 */
export function resumeText(profile: ResumeProfile): string {
  return [
    profile.headline,
    profile.summary,
    ...profile.experience.flatMap((job) => [
      `${job.title} ${job.company}`,
      ...job.bullets.map((b) => b.sourceRef || b.text),
    ]),
    ...profile.education.map((e) => [e.school, e.degree, e.field].filter(Boolean).join(" ")),
    profile.skills.join(", "),
    profile.languages.join(", "),
    profile.certifications.join(", "),
  ]
    .filter(Boolean)
    .join("\n")
}

/** İlanın aradığı ve CV'de kelimesi geçen kavramlar; özet yazımına verilir. */
export function supportedConceptTerms(posting: JobPostingData, cvText: string): string[] {
  const termList: string[] = []
  for (const req of posting.requirements) {
    for (const concept of req.concepts) {
      // CV'de gerçekten geçen biçim veriliyor, kavramın kanonik adı değil:
      // model yalnızca adayın kendi kelimesini öne çıkarabilsin.
      const member = [concept.term, ...concept.synonyms].find((t) => containsKeyword(cvText, t))
      if (member) termList.push(naturalSpelling(member))
    }
  }
  return [...new Set(termList)]
}

/**
 * Beceri listesine eklenecek terimler: ilanın beceri gereksinimlerinde geçen,
 * CV'nin deneyim maddelerinde yazan ama beceri listesinde olmayanlar.
 *
 * Uydurma değil: terim adayın kendi maddesinde geçiyor. Beceri listesi ise
 * ATS'lerin en çok taradığı bölüm (K-38).
 */
export function skillsFromBullets(profile: ResumeProfile, posting: JobPostingData): string[] {
  const bulletList = profile.experience.flatMap((j) => j.bullets.map((b) => b.sourceRef || b.text))
  const skillText = profile.skills.join(", ")
  const toAdd: string[] = []

  for (const req of posting.requirements) {
    if (req.type !== "skill") continue
    for (const concept of req.concepts) {
      const candidates = concept.term.includes(" / ")
        ? concept.synonyms
        : [concept.term, ...concept.synonyms]
      const found = candidates.find((t) => bulletList.some((m) => containsKeyword(m, t)))
      if (!found) continue
      if (candidates.some((t) => containsKeyword(skillText, t))) continue
      toAdd.push(found)
    }
  }
  return [...new Set(toAdd)]
}
