import { cosineSimilarity } from "../llm/embedding.js"
import { containsKeyword, normalizeTokens } from "../normalize/turkish.js"
import type { Concept, JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { ozelAdMi, type ScoreResult } from "../score/score.js"

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
  const acik: Array<{ concept: Concept; index: number }> = []
  let index = 0
  posting.requirements.forEach((req, r) => {
    const sonuc = result.requirements[r]
    for (const concept of req.concepts) {
      const eksik = sonuc?.missingConcepts.includes(concept.term) ?? true
      const yalnizAnlamsal = sonuc?.method === "semantic"
      if (eksik || yalnizAnlamsal) acik.push({ concept, index })
      index++
    }
  })
  return acik
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
  const acik = openConcepts(input.posting, input.result)
    // Özel adlar (GraphQL, Docker, Storybook) hedef olamaz: bir teknolojiyi
    // kullanıp kullanmadığın yeniden ifadeyle değişmez. Gömme benzerliği
    // bunu ayırt edemiyor; ölçümde "GraphQL" ile "REST API'lerle
    // entegrasyon" 0,64 çıktı, "SSR" ile "sunucu tarafı render" 0,54 (K-38).
    .filter(({ concept }) => !ozelAdMi(concept))

  // Her kavram yalnızca ona en yakın maddeye veriliyor. Aynı terimi birden
  // çok maddeye yazdırmak skora bir şey katmıyor, zorlama cümle üretiyordu
  // ("…ürün sayfalarını geliştirerek web performansı sağladım").
  const adaylar: Array<{ madde: number; concept: Concept; benzerlik: number }> = []
  for (const { concept, index } of acik) {
    const v = input.conceptVectors[index]
    if (!v) continue
    let enIyi: { madde: number; benzerlik: number } | null = null
    input.bullets.forEach((madde, i) => {
      const mv = input.bulletVectors[i]
      if (!mv || kavramGeciyor(madde, concept)) return
      // Tüm madde ile kısa bir kavramı karşılaştırınca gömme sinyali
      // sulanıyor: "Bütçe yönetimi" ile "aylık 150.000 TL bütçeyi optimize
      // ettim" yalnızca 0,42 çıktı. Kavramın bir içerik kelimesi maddede
      // (kök düzeyinde) geçiyorsa aday güçlenir; bu sinyal gömme modelinden
      // bağımsız (K-38).
      const benzerlik = cosineSimilarity(mv, v) + (kelimeOrtakMi(madde, concept.term) ? KELIME_BONUSU : 0)
      if (!enIyi || benzerlik > enIyi.benzerlik) enIyi = { madde: i, benzerlik }
    })
    const secilen = enIyi as { madde: number; benzerlik: number } | null
    if (secilen && secilen.benzerlik >= opts.minSimilarity) adaylar.push({ concept, ...secilen })
  }

  return input.bullets.map((_, i) =>
    adaylar
      .filter((a) => a.madde === i)
      .sort((a, b) => b.benzerlik - a.benzerlik)
      .slice(0, opts.maxPerBullet)
      .map(({ concept }) => ({ label: etiket(concept), concept })),
  )
}

const KELIME_BONUSU = 0.1

/**
 * Kavramın en az dört harfli bir kökü maddede geçiyor mu. Önek eşleşmesi:
 * kaynaştırma harfi kökte kalabiliyor ("bütçeyi" → "bütçey", "bütçe" →
 * "bütçe").
 */
function kelimeOrtakMi(madde: string, terim: string): boolean {
  const maddeKokleri = normalizeTokens(madde)
  return normalizeTokens(terim).some(
    (k) => k.length >= 4 && maddeKokleri.some((m) => m.startsWith(k) || (m.length >= 4 && k.startsWith(m))),
  )
}

/** Kavramın terimi ya da eş anlamlılarından biri metinde geçiyor mu. */
export function kavramGeciyor(metin: string, concept: Concept): boolean {
  return [concept.term, ...concept.synonyms].some((t) => containsKeyword(metin, t))
}

function etiket(concept: Concept): string {
  const term = dogalYazim(concept.term)
  // Seçenek grubunun terimi zaten üyelerini sayıyor: "Jest / Cypress".
  if (concept.term.includes(" / ") || concept.synonyms.length === 0) return term
  return `${term} (${concept.synonyms.join(", ")})`
}

/**
 * Betimleyici terim cümle içinde küçük harfle başlar. İlandaki madde başı
 * büyük harfi ("Bütçe yönetimi") modele olduğu gibi gidince yazım cümle
 * ortasında büyük harf taşıyordu (K-38). Özel adlara dokunulmuyor.
 */
export function dogalYazim(term: string): string {
  if (ozelAdMi({ term, synonyms: [] })) return term
  const [ilk, ...geri] = [...term]
  return ilk ? ilk.toLocaleLowerCase("tr") + geri.join("") : term
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
  const terimler: string[] = []
  for (const req of posting.requirements) {
    for (const concept of req.concepts) {
      // CV'de gerçekten geçen biçim veriliyor, kavramın kanonik adı değil:
      // model yalnızca adayın kendi kelimesini öne çıkarabilsin.
      const uye = [concept.term, ...concept.synonyms].find((t) => containsKeyword(cvText, t))
      if (uye) terimler.push(dogalYazim(uye))
    }
  }
  return [...new Set(terimler)]
}

/**
 * Beceri listesine eklenecek terimler: ilanın beceri gereksinimlerinde geçen,
 * CV'nin deneyim maddelerinde yazan ama beceri listesinde olmayanlar.
 *
 * Uydurma değil: terim adayın kendi maddesinde geçiyor. Beceri listesi ise
 * ATS'lerin en çok taradığı bölüm (K-38).
 */
export function skillsFromBullets(profile: ResumeProfile, posting: JobPostingData): string[] {
  const maddeler = profile.experience.flatMap((j) => j.bullets.map((b) => b.sourceRef || b.text))
  const beceriMetni = profile.skills.join(", ")
  const eklenecek: string[] = []

  for (const req of posting.requirements) {
    if (req.type !== "skill") continue
    for (const concept of req.concepts) {
      const adaylar = concept.term.includes(" / ")
        ? concept.synonyms
        : [concept.term, ...concept.synonyms]
      const bulunan = adaylar.find((t) => maddeler.some((m) => containsKeyword(m, t)))
      if (!bulunan) continue
      if (adaylar.some((t) => containsKeyword(beceriMetni, t))) continue
      eklenecek.push(bulunan)
    }
  }
  return [...new Set(eklenecek)]
}
