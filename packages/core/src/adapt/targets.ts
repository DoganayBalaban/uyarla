import { cosineSimilarity } from "../llm/embedding.js"
import { containsKeyword } from "../normalize/turkish.js"
import type { Concept, JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"

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

export const DEFAULT_TARGET_OPTIONS: TargetOptions = {
  minSimilarity: 0.5,
  maxPerBullet: 3,
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

  return input.bullets.map((madde, i) => {
    const maddeVektoru = input.bulletVectors[i]
    if (!maddeVektoru) return []

    return acik
      .filter(({ concept }) => !kavramGeciyor(madde, concept))
      .map(({ concept, index }) => {
        const v = input.conceptVectors[index]
        return { concept, benzerlik: v ? cosineSimilarity(maddeVektoru, v) : 0 }
      })
      .filter((x) => x.benzerlik >= opts.minSimilarity)
      .sort((a, b) => b.benzerlik - a.benzerlik)
      .slice(0, opts.maxPerBullet)
      .map(({ concept }) => ({ label: etiket(concept), concept }))
  })
}

/** Kavramın terimi ya da eş anlamlılarından biri metinde geçiyor mu. */
export function kavramGeciyor(metin: string, concept: Concept): boolean {
  return [concept.term, ...concept.synonyms].some((t) => containsKeyword(metin, t))
}

function etiket(concept: Concept): string {
  // Seçenek grubunun terimi zaten üyelerini sayıyor: "Jest / Cypress".
  if (concept.term.includes(" / ") || concept.synonyms.length === 0) return concept.term
  return `${concept.term} (${concept.synonyms.join(", ")})`
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
      const uye = [concept.term, ...concept.synonyms].find((t) => containsKeyword(cvText, t))
      if (uye) terimler.push(concept.term.includes(" / ") ? uye : concept.term)
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
