import { describe, expect, it } from "vitest"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"
import { alignmentTargets, skillsFromBullets, supportedConceptTerms } from "./targets.js"

const req = (text: string, concepts: Requirement["concepts"], type: Requirement["type"] = "skill"): Requirement => ({
  text,
  type,
  importance: "must",
  concepts,
})

const basePosting: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    req("Web performansı bilgisi", [{ term: "Web performansı", synonyms: [] }]),
    req("GraphQL ile çalışmış olmak", [{ term: "GraphQL", synonyms: [] }]),
    req("React deneyimi", [{ term: "React", synonyms: [] }]),
  ],
}

/** İlk iki gereksinim eksik, React kelimeyle karşılanmış. */
const outcome: ScoreResult = {
  score: 33,
  missingKeywords: ["Web performansı", "GraphQL"],
  requirements: basePosting.requirements.map((requirement, i) => ({
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
  const bulletList = ["Sayfa yüklenme süresini %40 azalttım"]

  it("targets an open, descriptive concept close to the bullet", () => {
    const [targetList] = alignmentTargets({
      bullets: bulletList,
      bulletVectors: [[1, 0]],
      posting: basePosting,
      // Hepsi maddeye çok yakın: ayrımı benzerlik değil kurallar yapmalı.
      conceptVectors: [[1, 0], [1, 0], [1, 0]],
      result: outcome,
    })
    expect(targetList!.map((h) => h.label)).toEqual(["web performansı"])
  })

  it("never targets a proper noun regardless of similarity", () => {
    // K-38: "GraphQL" ile "REST API'lerle entegrasyon" 0,64 benzerlik
    // veriyordu; teknoloji adı yeniden ifadeyle kazanılamaz.
    const [targetList] = alignmentTargets({
      bullets: bulletList,
      bulletVectors: [[1, 0]],
      posting: basePosting,
      conceptVectors: [[0, 1], [1, 0], [1, 0]],
      result: outcome,
    })
    expect(targetList).toEqual([])
  })

  it("also targets a concept slightly below the threshold if its stem is in the bullet", () => {
    const budgetPosting: JobPostingData = {
      ...basePosting,
      requirements: [req("Bütçe yönetimi", [{ term: "Bütçe yönetimi", synonyms: [] }])],
    }
    const budgetResult: ScoreResult = {
      ...outcome,
      requirements: [{ ...outcome.requirements[0]!, requirement: budgetPosting.requirements[0]!, missingConcepts: ["Bütçe yönetimi"] }],
    }
    // cos([1,0],[0.4,0.9165]) ≈ 0.40: tek başına eşiğin altında.
    const [targetList] = alignmentTargets({
      bullets: ["Aylık 150.000 TL bütçeyi optimize ettim"],
      bulletVectors: [[1, 0]],
      posting: budgetPosting,
      conceptVectors: [[0.4, 0.9165]],
      result: budgetResult,
    })
    expect(targetList!.map((h) => h.label)).toEqual(["bütçe yönetimi"])
  })

  it("assigns each concept only to the closest bullet", () => {
    const targetList = alignmentTargets({
      bullets: ["Sayfa yüklenme süresini azalttım", "Ürün sayfaları geliştirdim"],
      bulletVectors: [[1, 0], [0.8, 0.6]],
      posting: basePosting,
      conceptVectors: [[1, 0], [1, 0], [1, 0]],
      result: outcome,
    })
    expect(targetList.map((h) => h.map((x) => x.label))).toEqual([["web performansı"], []])
  })

  it("does not target an education requirement at a bullet", () => {
    // eval:adapt, cv-c: model bir deneyim maddesine "bilgisayar
    // mühendisliği" bölümünü yazıyordu.
    const educationPosting: JobPostingData = {
      ...basePosting,
      requirements: [
        req("Bilgisayar Mühendisliği mezunu", [{ term: "Bilgisayar Mühendisliği", synonyms: [] }], "education"),
        basePosting.requirements[0]!,
      ],
    }
    const [targetList] = alignmentTargets({
      bullets: bulletList,
      bulletVectors: [[1, 0]],
      posting: educationPosting,
      conceptVectors: [[1, 0], [1, 0]],
      result: {
        ...outcome,
        requirements: educationPosting.requirements.map((requirement) => ({
          requirement,
          status: "missing",
          confidence: 0,
          method: null,
          evidence: null,
          matchedConcepts: [],
          missingConcepts: [requirement.concepts[0]!.term],
        })),
      },
    })
    expect(targetList!.map((h) => h.label)).toEqual(["web performansı"])
  })

  it("does not target a concept below the threshold", () => {
    const [targetList] = alignmentTargets({
      bullets: bulletList,
      bulletVectors: [[1, 0]],
      posting: basePosting,
      conceptVectors: [[0, 1], [0, 1], [0, 1]],
      result: outcome,
    })
    expect(targetList).toEqual([])
  })
})

const resumeProfile: ResumeProfile = {
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
  it("returns the option-group member found in the resume, not the canonical name", () => {
    const testPosting: JobPostingData = {
      ...basePosting,
      requirements: [
        req("Testler (Jest, Cypress)", [
          { term: "entegrasyon testleri", synonyms: [] },
          { term: "Jest / Cypress", synonyms: ["Jest", "Cypress"] },
        ]),
      ],
    }
    expect(supportedConceptTerms(testPosting, "Jest ile birim test yazdım")).toEqual(["Jest"])
  })
})

describe("skillsFromBullets", () => {
  it("adds a posting skill present in a bullet but missing from the skill list", () => {
    const testPosting: JobPostingData = {
      ...basePosting,
      requirements: [
        req("Jest", [{ term: "Jest", synonyms: [] }]),
        req("React", [{ term: "React", synonyms: [] }]),
        req("Docker", [{ term: "Docker", synonyms: [] }]),
      ],
    }
    expect(skillsFromBullets(resumeProfile, testPosting)).toEqual(["Jest"])
  })

  it("does not add from a non-skill requirement", () => {
    const testPosting: JobPostingData = {
      ...basePosting,
      requirements: [req("Jest deneyimi", [{ term: "Jest", synonyms: [] }], "experience")],
    }
    expect(skillsFromBullets(resumeProfile, testPosting)).toEqual([])
  })
})
