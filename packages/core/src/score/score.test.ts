import { describe, it, expect } from "vitest"
import { conceptTexts, isProperNoun as isProperNoun, score } from "./score.js"
import { DEFAULT_SCORING_CONFIG } from "./config.js"
import type { Evidence } from "./evidence.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"

const PROFILE: ResumeProfile = {
  fullName: null, headline: null, summary: null,
  experience: [], education: [], skills: [], languages: [], certifications: [],
}

const ev = (text: string): Evidence =>
  ({ text, matchText: text, kind: "bullet", sourceRef: text })

/** Her anahtar kelime ayrı bir kavram sayılır (tek eş anlamlıyla). */
const req = (
  text: string,
  importance: "must" | "nice",
  conceptList: string[],
): Requirement => ({
  text,
  type: "skill",
  importance,
  concepts: conceptList.map((k) => ({ term: k, synonyms: [k] })),
})

/** Tek kavram, birden çok eş anlamlı. */
const synonymRequirement = (
  text: string,
  importance: "must" | "nice",
  term: string,
  synonyms: string[],
): Requirement => ({ text, type: "skill", importance, concepts: [{ term, synonyms }] })

const testPosting = (requirements: Requirement[]): JobPostingData => ({
  position: "Geliştirici", company: null, seniority: null, language: "tr", requirements,
})

/** Sahte vektörler: yakın=birbirine benzer, uzak=dik. */
const V = { near: [1, 0], mid: [0.8, 0.6], far: [0, 1] }

describe("score · evidence search", () => {
  it("an exact keyword match has confidence 1.0 and method keyword", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("React deneyimi", "must", ["react"])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("matched")
    expect(outcome.requirements[0]!.confidence).toBe(1)
    expect(outcome.requirements[0]!.method).toBe("keyword")
    expect(outcome.score).toBe(100)
  })

  it("a keyword match takes precedence over a semantic match", () => {
    // Kelime eşleşmesi bulunduğunda vektörlere hiç bakılmamalı: güven 1.0
    // kalmalı, benzerlik değerine düşmemeli.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("React", "must", ["react"])]),
      evidence: [ev("React biliyorum")],
      evidenceVectors: [V.mid],
      conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.method).toBe("keyword")
    expect(outcome.requirements[0]!.confidence).toBe(1)
  })

  it("falls back to semantic matching when no keyword matches", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Arayüz geliştirme", "must", ["kubernetes"])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.near],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("matched")
    expect(outcome.requirements[0]!.method).toBe("semantic")
    expect(outcome.requirements[0]!.confidence).toBeCloseTo(1)
  })

  it("picks the closest evidence, not the first", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Arayüz", "must", ["yok"])]),
      evidence: [ev("orta yakınlıkta madde"), ev("en yakın madde")],
      evidenceVectors: [V.mid, V.near],
      conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.evidence!.text).toBe("en yakın madde")
  })

  it("similarity below the threshold counts as missing and shows no evidence", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Kubernetes", "must", ["kubernetes"])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("missing")
    expect(outcome.requirements[0]!.evidence).toBeNull()
    expect(outcome.requirements[0]!.method).toBeNull()
    expect(outcome.score).toBe(0)
  })

  it("skips the semantic stage without vectors instead of crashing", () => {
    // İlan çıkarımı anahtar kelimesiz gereksinim döndürebilir (K-11 hizalama).
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Kubernetes", "must", [])]),
      evidence: [ev("React")],
      evidenceVectors: [],
      conceptVectors: [],
    })
    expect(outcome.requirements[0]!.status).toBe("missing")
  })
})

describe("score · wrong-evidence guard", () => {
  it("does not match a word in the context prefix and show the wrong bullet", () => {
    // Gerçek vakadan: model "Next.js deneyimi" için keywords'e "frontend"
    // koymuştu ve unvan ön eki yüzünden alakasız bir madde kanıt olarak
    // gösteriliyordu.
    const linkedEvidence: Evidence = {
      text: "Frontend Geliştirici · Acme: React ile panel geliştirdim",
      matchText: "React ile panel geliştirdim",
      kind: "bullet",
      sourceRef: "React ile panel geliştirdim",
    }
    const roleEvidence: Evidence = {
      text: "Frontend Geliştirici · Acme",
      matchText: "Frontend Geliştirici · Acme",
      kind: "role",
      sourceRef: null,
    }

    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Next.js deneyimi", "nice", ["frontend"])]),
      evidence: [linkedEvidence, roleEvidence],
      evidenceVectors: [V.far, V.far],
      conceptVectors: [V.near],
    })

    // Eşleşme rol kanıtıyla olmalı, alakasız maddeyle değil.
    expect(outcome.requirements[0]!.evidence!.kind).toBe("role")
  })
})

describe("score · weighting", () => {
  it("a must requirement weighs twice a nice one", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([
        req("React", "must", ["react"]),
        req("Kubernetes", "nice", ["kubernetes"]),
      ]),
      evidence: [ev("React biliyorum")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near, V.near],
    })

    // (2.0 × 1.0 + 1.0 × 0) / 3.0 = 0.667 → 67
    expect(outcome.score).toBe(67)
  })

  it("the score stays low when nice is met but must is not", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([
        req("Kubernetes", "must", ["kubernetes"]),
        req("React", "nice", ["react"]),
      ]),
      evidence: [ev("React biliyorum")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near, V.near],
    })
    // (2.0 × 0 + 1.0 × 1.0) / 3.0 = 0.333 → 33
    expect(outcome.score).toBe(33)
  })

  it("a semantic match contributes its similarity, not full credit", () => {
    const outcome = score(
      {
        profile: PROFILE,
        posting: testPosting([req("Arayüz", "must", ["yok"])]),
        evidence: [ev("madde")],
        evidenceVectors: [V.mid],
        conceptVectors: [V.near],
      },
      { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 },
    )
    // cos([1,0],[0.8,0.6]) = 0.8
    expect(outcome.requirements[0]!.confidence).toBeCloseTo(0.8)
    expect(outcome.score).toBe(80)
  })

  it("returns a score of 0, not NaN, when there are no requirements", () => {
    const outcome = score({
      profile: PROFILE, posting: testPosting([]),
      evidence: [], evidenceVectors: [], conceptVectors: [],
    })
    expect(outcome.score).toBe(0)
    expect(outcome.requirements).toEqual([])
  })

  it("every requirement is missing when the resume has no evidence", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("React", "must", ["react"])]),
      evidence: [], evidenceVectors: [], conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.status).toBe("missing")
    expect(outcome.score).toBe(0)
  })
})

describe("score · missing keyword list", () => {
  it("lists keywords of missing requirements only", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([
        req("React", "must", ["react"]),
        req("Kubernetes", "must", ["kubernetes", "k8s"]),
      ]),
      evidence: [ev("React biliyorum")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near, V.near],
    })

    expect(outcome.missingKeywords).toEqual(["kubernetes", "k8s"])
  })

  it("does not list the same word twice", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([
        req("Kubernetes deneyimi", "must", ["kubernetes"]),
        req("K8s bilgisi", "nice", ["kubernetes", "k8s"]),
      ]),
      evidence: [ev("React")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near, V.near],
    })
    expect(outcome.missingKeywords).toEqual(["kubernetes", "k8s"])
  })
})

describe("score · configuration", () => {
  it("the threshold is read from configuration", () => {
    const scoreInput = {
      profile: PROFILE,
      posting: testPosting([req("Arayüz", "must", ["yok"])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.mid],
      conceptVectors: [V.near],
    }

    const strict = score(scoreInput, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.95 })
    const loose = score(scoreInput, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 })

    expect(strict.requirements[0]!.status).toBe("missing")
    expect(loose.requirements[0]!.status).toBe("matched")
  })

  it("weights are read from configuration", () => {
    const scoreInput = {
      profile: PROFILE,
      posting: testPosting([
        req("React", "must", ["react"]),
        req("Kubernetes", "nice", ["kubernetes"]),
      ]),
      evidence: [ev("React")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near, V.near],
    }

    // must ve nice eşit ağırlıkta olsaydı: (1 + 0) / 2 = %50
    expect(score(scoreInput, { ...DEFAULT_SCORING_CONFIG, mustWeight: 1 }).score).toBe(50)
  })
})


describe("score · proportional confidence (K-23)", () => {
  it("confidence is a quarter when one of four concepts is met", () => {
    // "Git ve CI/CD, Microservices, Docker" gereksiniminde yalnızca Git bilen
    // aday tam puan alıyordu; ilanlar sık sık böyle bileşik yazılıyor.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Git, CI/CD, Microservices, Docker", "must", [
        "git", "ci/cd", "microservices", "docker",
      ])]),
      evidence: [ev("Git ile versiyon kontrolü yaptım")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.confidence).toBeCloseTo(0.25)
    expect(outcome.requirements[0]!.matchedConcepts).toEqual(["git"])
    expect(outcome.requirements[0]!.missingConcepts).toEqual([
      "ci/cd", "microservices", "docker",
    ])
    expect(outcome.score).toBe(25)
  })

  it("confidence is full when all concepts are met", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Git ve Docker", "must", ["git", "docker"])]),
      evidence: [ev("Git ve Docker kullandım")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.confidence).toBe(1)
    expect(outcome.requirements[0]!.missingConcepts).toEqual([])
  })

  it("one synonym is enough and does not lower the ratio", () => {
    // ["react","react.js","reactjs"] aynı şeyin adları; biri eşleşirse tam.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([
        synonymRequirement("React deneyimi", "must", "react", [
          "react", "react.js", "reactjs",
        ]),
      ]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.confidence).toBe(1)
  })

  it("missing concepts of a partially met requirement enter the list", () => {
    // Kullanıcı "React'in var ama Docker'ın yok" bilgisini görmeli.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("React ve Docker", "must", ["react", "docker"])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })
    expect(outcome.missingKeywords).toEqual(["docker"])
  })

  it("a requirement without concepts counts as missing", () => {
    // splitIntoConcepts her gereksinim için en az bir kavram üretiyor;
    // boş liste geçersiz bir durum ve savunma amaçlı eksik sayılıyor.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Arayüz geliştirme", "must", [])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.near],
      conceptVectors: [],
    })
    expect(outcome.requirements[0]!.status).toBe("missing")
  })

  it("an exact keyword match contributes more than a semantic match", () => {
    const word = score({
      profile: PROFILE,
      posting: testPosting([req("React", "must", ["react"])]),
      evidence: [ev("React ile panel geliştirdim")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })
    const semantic = score(
      {
        profile: PROFILE,
        posting: testPosting([req("Arayüz", "must", ["arayüz"])]),
        evidence: [ev("React ile panel geliştirdim")],
        evidenceVectors: [V.mid],
        conceptVectors: [V.near],
      },
      { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 },
    )

    expect(word.requirements[0]!.confidence).toBe(1)
    expect(semantic.requirements[0]!.confidence).toBeLessThan(1)
    expect(semantic.requirements[0]!.method).toBe("semantic")
  })
})

describe("score · evidence scope by requirement type (K-36)", () => {
  const typedRequirement = (type: Requirement["type"], conceptItem: string): Requirement => ({
    text: `${conceptItem} deneyimi`,
    type,
    importance: "must",
    concepts: [{ term: conceptItem, synonyms: [conceptItem] }],
  })

  const typedEvidence = (text: string, kind: Evidence["kind"]): Evidence => ({
    text,
    matchText: text,
    kind,
    sourceRef: null,
  })

  it("an experience requirement is not met by skill-list evidence", () => {
    // Ölçülen uydurma: "Generative AI ve LLM tabanlı uygulamalar konusunda
    // PROFESYONEL PROJE GELİŞTİRME deneyimine sahip olmak" gereksinimi, yeni
    // mezunun beceri listesindeki "Yapay Zeka Araçları" satırıyla 0.7056
    // benzerlikte eşleşiyordu. Beceri listesi bir iddiadır, deneyim kanıtı
    // değil.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("experience", "yapay zeka")]),
      evidence: [typedEvidence("Yapay Zeka Araçları", "skill")],
      evidenceVectors: [V.near],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("missing")
  })

  it("an experience requirement is met by bullet and title evidence", () => {
    for (const kind of ["bullet", "role"] as const) {
      const outcome = score({
        profile: PROFILE,
        posting: testPosting([typedRequirement("experience", "yapay zeka")]),
        evidence: [typedEvidence("Yapay zeka projeleri geliştirdim", kind)],
        evidenceVectors: [V.near],
        conceptVectors: [V.near],
      })
      expect(outcome.requirements[0]!.status).toBe("matched")
    }
  })

  it("the restriction applies only to experience, not skill", () => {
    // Daraltmayı experience dışına taşırmak ölçümde geriye götürüyor: beceri
    // gereksinimlerinin meşru anlamsal eşleşmelerinin hepsi beceri listesinden
    // geliyor (K-36).
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("skill", "yapay zeka")]),
      evidence: [typedEvidence("Yapay Zeka Araçları", "skill")],
      evidenceVectors: [V.near],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("matched")
  })

  it("the evidence kind restriction also applies to keyword matching", () => {
    // Kısıt yalnızca anlamsal katmana konsaydı aynı uydurma kelime
    // eşleşmesiyle geri gelirdi. Gereksinimin türü kanıtın türünü belirler;
    // hangi aşamanın bulduğu fark etmez.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("experience", "kubernetes")]),
      evidence: [typedEvidence("Kubernetes", "skill")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("missing")
  })

  it("evidence scope is read from configuration", () => {
    const loose = score(
      {
        profile: PROFILE,
        posting: testPosting([typedRequirement("experience", "kubernetes")]),
        evidence: [typedEvidence("Kubernetes", "skill")],
        evidenceVectors: [V.far],
        conceptVectors: [V.near],
      },
      {
        ...DEFAULT_SCORING_CONFIG,
        evidenceKindsByType: {
          ...DEFAULT_SCORING_CONFIG.evidenceKindsByType,
          experience: ["role", "bullet", "skill", "education"],
        },
      },
    )

    expect(loose.requirements[0]!.status).toBe("matched")
  })

  it("vector alignment does not shift when evidence is restricted", () => {
    // Kanıt listesi filtrelenirken evidenceVectors ile olan index eşlemesi
    // korunmalı; kayarsa yanlış madde kanıt gösterilir.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("experience", "arayüz")]),
      evidence: [
        typedEvidence("Yapay Zeka Araçları", "skill"),
        typedEvidence("Panel arayüzü geliştirdim", "bullet"),
      ],
      // Beceri kanıtı yakın, madde kanıtı orta: kısıt olmasaydı beceri
      // seçilirdi.
      evidenceVectors: [V.near, V.mid],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.evidence!.text).toBe("Panel arayüzü geliştirdim")
  })

  it("an experience requirement is met at a discount by a summary sentence", () => {
    // K-38: "3 yıllık performans pazarlaması deneyimi" özette yazan aday
    // "En az 3 yıl performans pazarlaması deneyimi" gereksiniminde eksik
    // görünüyordu.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("experience", "performans pazarlaması")]),
      evidence: [typedEvidence("Performans pazarlamasında 3 yıllık deneyim.", "summary")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("matched")
    expect(outcome.requirements[0]!.confidence).toBe(DEFAULT_SCORING_CONFIG.summaryWeight)
  })

  it("a bullet becomes the evidence instead of the summary when it also mentions the concept", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("experience", "kubernetes")]),
      evidence: [
        typedEvidence("Kubernetes ile dağıtım yaptım", "bullet"),
        typedEvidence("Kubernetes meraklısıyım.", "summary"),
      ],
      evidenceVectors: [V.far, V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.confidence).toBe(1)
    expect(outcome.requirements[0]!.evidence!.kind).toBe("bullet")
  })

  it("in semantic matching a bullet over the threshold is preferred to a slightly more similar summary", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("experience", "arayüz")]),
      evidence: [
        typedEvidence("Kullanıcı deneyimine önem veririm.", "summary"),
        typedEvidence("Panel geliştirdim", "bullet"),
      ],
      evidenceVectors: [V.near, V.mid],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.evidence!.kind).toBe("bullet")
  })

  it("a language requirement is met by the Languages section", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([typedRequirement("skill", "İngilizce")]),
      evidence: [typedEvidence("İngilizce (ileri)", "language")],
      evidenceVectors: [V.far],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.status).toBe("matched")
    expect(outcome.requirements[0]!.confidence).toBe(1)
  })
})

describe("score · semantic matching disabled for proper nouns (K-38)", () => {
  it("a technology name does not semantically match another technology name", () => {
    // Uçtan uca testte "GraphQL" beceri listesindeki "Next.js" ile 0,74
    // benzerlikte eşleşmişti; CV'de GraphQL yoktu.
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([synonymRequirement("GraphQL ile çalışmış olmak", "must", "GraphQL", [])]),
      evidence: [{ text: "Next.js", matchText: "Next.js", kind: "skill", sourceRef: null }],
      evidenceVectors: [V.near],
      conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.status).toBe("missing")
  })

  it("a descriptive concept stays open to semantic matching", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([synonymRequirement("Web performansı", "must", "Web performansı", [])]),
      evidence: [ev("Sayfa yüklenme süresini %40 azalttım")],
      evidenceVectors: [V.near],
      conceptVectors: [V.near],
    })
    expect(outcome.requirements[0]!.method).toBe("semantic")
  })

  it("recognizes a proper noun", () => {
    for (const term of [
      "GraphQL", "CI/CD", "Next.js", "Google Analytics 4", "Docker", "C#",
      "A/B testleri", "SQL sorguları", "Google Tag Manager",
    ]) {
      expect(isProperNoun({ term, synonyms: [] })).toBe(true)
    }
    for (const term of [
      "Web performansı", "birim testleri", "tasarım sistemi", "yapay zeka",
      // Başlık düzeninde Türkçe alan adı: K-37'nin meşru anlamsal eşleşmesi.
      "Yazılım Mühendisliği",
    ]) {
      expect(isProperNoun({ term, synonyms: [] })).toBe(false)
    }
    // Eş anlamlılardan biri betimleyiciyse kavram özel ad sayılmaz.
    expect(isProperNoun({ term: "WCAG", synonyms: ["erişilebilirlik"] })).toBe(false)
  })
})

describe("score · type scope of the semantic layer (K-36)", () => {
  it("the semantic layer applies only to allowed types", () => {
    // Birikmiş işler #7: anlamsal eşleşmeyi yalnızca soft türünde kullanmak.
    // Ölçümde reddedildi, ama kapsam yapılandırılabilir kaldı ki değerlendirme
    // seti büyüdüğünde tarama tekrarlanabilsin.
    const softOnly = score(
      {
        profile: PROFILE,
        posting: testPosting([
          { ...req("Takım çalışması", "must", ["uyum"]), type: "soft" },
          { ...req("Kubernetes", "must", ["kubernetes"]), type: "skill" },
        ]),
        evidence: [ev("Takım içinde birlikte çalıştım")],
        evidenceVectors: [V.near],
        conceptVectors: [V.near, V.near],
      },
      { ...DEFAULT_SCORING_CONFIG, semanticTypes: ["soft"] },
    )

    expect(softOnly.requirements[0]!.status).toBe("matched")
    expect(softOnly.requirements[0]!.method).toBe("semantic")
    expect(softOnly.requirements[1]!.status).toBe("missing")
  })

  it("the default scope includes all types", () => {
    const outcome = score({
      profile: PROFILE,
      posting: testPosting([req("Arayüz", "must", ["arayüz"])]),
      evidence: [ev("Panel geliştirdim")],
      evidenceVectors: [V.near],
      conceptVectors: [V.near],
    })

    expect(outcome.requirements[0]!.method).toBe("semantic")
  })
})
