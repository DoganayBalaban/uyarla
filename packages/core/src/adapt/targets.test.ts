import { describe, expect, it } from "vitest"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"
import { alignmentTargets, skillsFromBullets, supportedConceptTerms } from "./targets.js"

const gereksinim = (text: string, concepts: Requirement["concepts"], type: Requirement["type"] = "skill"): Requirement => ({
  text,
  type,
  importance: "must",
  concepts,
})

const ilan: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    gereksinim("Web performansı bilgisi", [{ term: "Web performansı", synonyms: [] }]),
    gereksinim("GraphQL ile çalışmış olmak", [{ term: "GraphQL", synonyms: [] }]),
    gereksinim("React deneyimi", [{ term: "React", synonyms: [] }]),
  ],
}

/** İlk iki gereksinim eksik, React kelimeyle karşılanmış. */
const sonuc: ScoreResult = {
  score: 33,
  missingKeywords: ["Web performansı", "GraphQL"],
  requirements: ilan.requirements.map((requirement, i) => ({
    requirement,
    status: i === 2 ? "matched" : "missing",
    confidence: i === 2 ? 1 : 0,
    method: i === 2 ? "keyword" : null,
    evidence: null,
    matchedConcepts: i === 2 ? ["React"] : [],
    missingConcepts: i === 2 ? [] : [requirement.concepts[0]!.term],
  })),
}

describe("alignmentTargets", () => {
  const maddeler = ["Sayfa yüklenme süresini %40 azalttım"]

  it("maddeye yakın, açık ve betimleyici kavramı hedef yapar", () => {
    const [hedefler] = alignmentTargets({
      bullets: maddeler,
      bulletVectors: [[1, 0]],
      posting: ilan,
      // Hepsi maddeye çok yakın: ayrımı benzerlik değil kurallar yapmalı.
      conceptVectors: [[1, 0], [1, 0], [1, 0]],
      result: sonuc,
    })
    expect(hedefler!.map((h) => h.label)).toEqual(["web performansı"])
  })

  it("özel adı, benzerliği ne olursa olsun hedef yapmaz", () => {
    // K-38: "GraphQL" ile "REST API'lerle entegrasyon" 0,64 benzerlik
    // veriyordu; teknoloji adı yeniden ifadeyle kazanılamaz.
    const [hedefler] = alignmentTargets({
      bullets: maddeler,
      bulletVectors: [[1, 0]],
      posting: ilan,
      conceptVectors: [[0, 1], [1, 0], [1, 0]],
      result: sonuc,
    })
    expect(hedefler).toEqual([])
  })

  it("kavramın kökü maddede geçiyorsa eşiğin biraz altındaki kavramı da verir", () => {
    const butceIlan: JobPostingData = {
      ...ilan,
      requirements: [gereksinim("Bütçe yönetimi", [{ term: "Bütçe yönetimi", synonyms: [] }])],
    }
    const butceSonuc: ScoreResult = {
      ...sonuc,
      requirements: [{ ...sonuc.requirements[0]!, requirement: butceIlan.requirements[0]!, missingConcepts: ["Bütçe yönetimi"] }],
    }
    // cos([1,0],[0.4,0.9165]) ≈ 0.40: tek başına eşiğin altında.
    const [hedefler] = alignmentTargets({
      bullets: ["Aylık 150.000 TL bütçeyi optimize ettim"],
      bulletVectors: [[1, 0]],
      posting: butceIlan,
      conceptVectors: [[0.4, 0.9165]],
      result: butceSonuc,
    })
    expect(hedefler!.map((h) => h.label)).toEqual(["bütçe yönetimi"])
  })

  it("her kavramı yalnızca en yakın maddeye verir", () => {
    const hedefler = alignmentTargets({
      bullets: ["Sayfa yüklenme süresini azalttım", "Ürün sayfaları geliştirdim"],
      bulletVectors: [[1, 0], [0.8, 0.6]],
      posting: ilan,
      conceptVectors: [[1, 0], [1, 0], [1, 0]],
      result: sonuc,
    })
    expect(hedefler.map((h) => h.map((x) => x.label))).toEqual([["web performansı"], []])
  })

  it("eşiğin altındaki kavramı vermez", () => {
    const [hedefler] = alignmentTargets({
      bullets: maddeler,
      bulletVectors: [[1, 0]],
      posting: ilan,
      conceptVectors: [[0, 1], [0, 1], [0, 1]],
      result: sonuc,
    })
    expect(hedefler).toEqual([])
  })
})

const profil: ResumeProfile = {
  fullName: null,
  headline: null,
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [{ text: "Jest ile birim test yazdım", sourceRef: "Jest ile birim test yazdım" }],
    },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}

describe("supportedConceptTerms", () => {
  it("seçenek grubunda CV'de geçen üyeyi verir, kanonik adı değil", () => {
    const testIlan: JobPostingData = {
      ...ilan,
      requirements: [
        gereksinim("Testler (Jest, Cypress)", [
          { term: "entegrasyon testleri", synonyms: [] },
          { term: "Jest / Cypress", synonyms: ["Jest", "Cypress"] },
        ]),
      ],
    }
    expect(supportedConceptTerms(testIlan, "Jest ile birim test yazdım")).toEqual(["Jest"])
  })
})

describe("skillsFromBullets", () => {
  it("maddede geçen ama beceri listesinde olmayan ilan becerisini ekler", () => {
    const testIlan: JobPostingData = {
      ...ilan,
      requirements: [
        gereksinim("Jest", [{ term: "Jest", synonyms: [] }]),
        gereksinim("React", [{ term: "React", synonyms: [] }]),
        gereksinim("Docker", [{ term: "Docker", synonyms: [] }]),
      ],
    }
    expect(skillsFromBullets(profil, testIlan)).toEqual(["Jest"])
  })

  it("beceri türü olmayan gereksinimden eklemez", () => {
    const testIlan: JobPostingData = {
      ...ilan,
      requirements: [gereksinim("Jest deneyimi", [{ term: "Jest", synonyms: [] }], "experience")],
    }
    expect(skillsFromBullets(profil, testIlan)).toEqual([])
  })
})
