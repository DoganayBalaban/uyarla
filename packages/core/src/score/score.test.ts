import { describe, it, expect } from "vitest"
import { conceptTexts, score } from "./score.js"
import { DEFAULT_SCORING_CONFIG } from "./config.js"
import type { Evidence } from "./evidence.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"

const PROFILE: ResumeProfile = {
  fullName: null, headline: null, summary: null,
  experience: [], education: [], skills: [], languages: [], certifications: [],
}

const kanit = (text: string): Evidence =>
  ({ text, matchText: text, kind: "bullet", sourceRef: text })

/** Her anahtar kelime ayrı bir kavram sayılır (tek eş anlamlıyla). */
const gereksinim = (
  text: string,
  importance: "must" | "nice",
  kavramlar: string[],
): Requirement => ({
  text,
  type: "skill",
  importance,
  concepts: kavramlar.map((k) => ({ term: k, synonyms: [k] })),
})

/** Tek kavram, birden çok eş anlamlı. */
const esAnlamliGereksinim = (
  text: string,
  importance: "must" | "nice",
  term: string,
  synonyms: string[],
): Requirement => ({ text, type: "skill", importance, concepts: [{ term, synonyms }] })

const ilan = (requirements: Requirement[]): JobPostingData => ({
  position: "Geliştirici", company: null, seniority: null, language: "tr", requirements,
})

/** Sahte vektörler: yakın=birbirine benzer, uzak=dik. */
const V = { yakin: [1, 0], orta: [0.8, 0.6], uzak: [0, 1] }

describe("score · kanıt arama", () => {
  it("tam kelime eşleşmesinde güven 1.0 ve yöntem keyword olur", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("React deneyimi", "must", ["react"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })

    expect(sonuc.requirements[0]!.status).toBe("matched")
    expect(sonuc.requirements[0]!.confidence).toBe(1)
    expect(sonuc.requirements[0]!.method).toBe("keyword")
    expect(sonuc.score).toBe(100)
  })

  it("kelime eşleşmesi anlamsal eşleşmeye önceliklidir", () => {
    // Kelime eşleşmesi bulunduğunda vektörlere hiç bakılmamalı: güven 1.0
    // kalmalı, benzerlik değerine düşmemeli.
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("React", "must", ["react"])]),
      evidence: [kanit("React biliyorum")],
      evidenceVectors: [V.orta],
      conceptVectors: [V.yakin],
    })
    expect(sonuc.requirements[0]!.method).toBe("keyword")
    expect(sonuc.requirements[0]!.confidence).toBe(1)
  })

  it("kelime eşleşmezse anlamsal eşleşmeye düşer", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Arayüz geliştirme", "must", ["kubernetes"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.yakin],
      conceptVectors: [V.yakin],
    })

    expect(sonuc.requirements[0]!.status).toBe("matched")
    expect(sonuc.requirements[0]!.method).toBe("semantic")
    expect(sonuc.requirements[0]!.confidence).toBeCloseTo(1)
  })

  it("en yakın kanıtı seçer, ilk geçeni değil", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Arayüz", "must", ["yok"])]),
      evidence: [kanit("orta yakınlıkta madde"), kanit("en yakın madde")],
      evidenceVectors: [V.orta, V.yakin],
      conceptVectors: [V.yakin],
    })
    expect(sonuc.requirements[0]!.evidence!.text).toBe("en yakın madde")
  })

  it("eşiğin altındaki benzerlik eksik sayılır ve kanıt gösterilmez", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Kubernetes", "must", ["kubernetes"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })

    expect(sonuc.requirements[0]!.status).toBe("missing")
    expect(sonuc.requirements[0]!.evidence).toBeNull()
    expect(sonuc.requirements[0]!.method).toBeNull()
    expect(sonuc.score).toBe(0)
  })

  it("vektör yoksa anlamsal aşamayı atlar, çökmez", () => {
    // İlan çıkarımı anahtar kelimesiz gereksinim döndürebilir (K-11 hizalama).
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Kubernetes", "must", [])]),
      evidence: [kanit("React")],
      evidenceVectors: [],
      conceptVectors: [],
    })
    expect(sonuc.requirements[0]!.status).toBe("missing")
  })
})

describe("score · yanlış kanıt koruması", () => {
  it("bağlam ön ekindeki kelimeyle eşleşip yanlış madde göstermez", () => {
    // Gerçek vakadan: model "Next.js deneyimi" için keywords'e "frontend"
    // koymuştu ve unvan ön eki yüzünden alakasız bir madde kanıt olarak
    // gösteriliyordu.
    const bagliKanit: Evidence = {
      text: "Frontend Geliştirici · Acme: React ile panel geliştirdim",
      matchText: "React ile panel geliştirdim",
      kind: "bullet",
      sourceRef: "React ile panel geliştirdim",
    }
    const rolKaniti: Evidence = {
      text: "Frontend Geliştirici · Acme",
      matchText: "Frontend Geliştirici · Acme",
      kind: "role",
      sourceRef: null,
    }

    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Next.js deneyimi", "nice", ["frontend"])]),
      evidence: [bagliKanit, rolKaniti],
      evidenceVectors: [V.uzak, V.uzak],
      conceptVectors: [V.yakin],
    })

    // Eşleşme rol kanıtıyla olmalı, alakasız maddeyle değil.
    expect(sonuc.requirements[0]!.evidence!.kind).toBe("role")
  })
})

describe("score · ağırlıklandırma", () => {
  it("must gereksinimi nice'ın iki katı ağırlıkta", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([
        gereksinim("React", "must", ["react"]),
        gereksinim("Kubernetes", "nice", ["kubernetes"]),
      ]),
      evidence: [kanit("React biliyorum")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin, V.yakin],
    })

    // (2.0 × 1.0 + 1.0 × 0) / 3.0 = 0.667 → 67
    expect(sonuc.score).toBe(67)
  })

  it("nice karşılanıp must karşılanmazsa skor düşük kalır", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([
        gereksinim("Kubernetes", "must", ["kubernetes"]),
        gereksinim("React", "nice", ["react"]),
      ]),
      evidence: [kanit("React biliyorum")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin, V.yakin],
    })
    // (2.0 × 0 + 1.0 × 1.0) / 3.0 = 0.333 → 33
    expect(sonuc.score).toBe(33)
  })

  it("anlamsal eşleşme benzerlik değeri kadar katkı verir, tam değil", () => {
    const sonuc = score(
      {
        profile: PROFILE,
        posting: ilan([gereksinim("Arayüz", "must", ["yok"])]),
        evidence: [kanit("madde")],
        evidenceVectors: [V.orta],
        conceptVectors: [V.yakin],
      },
      { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 },
    )
    // cos([1,0],[0.8,0.6]) = 0.8
    expect(sonuc.requirements[0]!.confidence).toBeCloseTo(0.8)
    expect(sonuc.score).toBe(80)
  })

  it("gereksinim yoksa skor 0 döner, NaN değil", () => {
    const sonuc = score({
      profile: PROFILE, posting: ilan([]),
      evidence: [], evidenceVectors: [], conceptVectors: [],
    })
    expect(sonuc.score).toBe(0)
    expect(sonuc.requirements).toEqual([])
  })

  it("CV'de hiç kanıt yoksa her gereksinim eksik olur", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("React", "must", ["react"])]),
      evidence: [], evidenceVectors: [], conceptVectors: [V.yakin],
    })
    expect(sonuc.requirements[0]!.status).toBe("missing")
    expect(sonuc.score).toBe(0)
  })
})

describe("score · eksik kelime listesi", () => {
  it("yalnızca eksik gereksinimlerin anahtar kelimelerini listeler", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([
        gereksinim("React", "must", ["react"]),
        gereksinim("Kubernetes", "must", ["kubernetes", "k8s"]),
      ]),
      evidence: [kanit("React biliyorum")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin, V.yakin],
    })

    expect(sonuc.missingKeywords).toEqual(["kubernetes", "k8s"])
  })

  it("aynı kelimeyi iki kez listelemez", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([
        gereksinim("Kubernetes deneyimi", "must", ["kubernetes"]),
        gereksinim("K8s bilgisi", "nice", ["kubernetes", "k8s"]),
      ]),
      evidence: [kanit("React")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin, V.yakin],
    })
    expect(sonuc.missingKeywords).toEqual(["kubernetes", "k8s"])
  })
})

describe("score · yapılandırma", () => {
  it("eşik yapılandırmadan okunur", () => {
    const girdi = {
      profile: PROFILE,
      posting: ilan([gereksinim("Arayüz", "must", ["yok"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.orta],
      conceptVectors: [V.yakin],
    }

    const kati = score(girdi, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.95 })
    const gevsek = score(girdi, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 })

    expect(kati.requirements[0]!.status).toBe("missing")
    expect(gevsek.requirements[0]!.status).toBe("matched")
  })

  it("ağırlıklar yapılandırmadan okunur", () => {
    const girdi = {
      profile: PROFILE,
      posting: ilan([
        gereksinim("React", "must", ["react"]),
        gereksinim("Kubernetes", "nice", ["kubernetes"]),
      ]),
      evidence: [kanit("React")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin, V.yakin],
    }

    // must ve nice eşit ağırlıkta olsaydı: (1 + 0) / 2 = %50
    expect(score(girdi, { ...DEFAULT_SCORING_CONFIG, mustWeight: 1 }).score).toBe(50)
  })
})


describe("score · oransal güven (K-23)", () => {
  it("dört kavramdan biri karşılanırsa güven çeyrek olur", () => {
    // "Git ve CI/CD, Microservices, Docker" gereksiniminde yalnızca Git bilen
    // aday tam puan alıyordu; ilanlar sık sık böyle bileşik yazılıyor.
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Git, CI/CD, Microservices, Docker", "must", [
        "git", "ci/cd", "microservices", "docker",
      ])]),
      evidence: [kanit("Git ile versiyon kontrolü yaptım")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })

    expect(sonuc.requirements[0]!.confidence).toBeCloseTo(0.25)
    expect(sonuc.requirements[0]!.matchedConcepts).toEqual(["git"])
    expect(sonuc.requirements[0]!.missingConcepts).toEqual([
      "ci/cd", "microservices", "docker",
    ])
    expect(sonuc.score).toBe(25)
  })

  it("bütün kavramlar karşılanırsa güven tam olur", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Git ve Docker", "must", ["git", "docker"])]),
      evidence: [kanit("Git ve Docker kullandım")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })
    expect(sonuc.requirements[0]!.confidence).toBe(1)
    expect(sonuc.requirements[0]!.missingConcepts).toEqual([])
  })

  it("eş anlamlılardan biri yeterlidir, oranı düşürmez", () => {
    // ["react","react.js","reactjs"] aynı şeyin adları; biri eşleşirse tam.
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([
        esAnlamliGereksinim("React deneyimi", "must", "react", [
          "react", "react.js", "reactjs",
        ]),
      ]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })
    expect(sonuc.requirements[0]!.confidence).toBe(1)
  })

  it("kısmen karşılanan gereksinimin eksik kavramları listeye girer", () => {
    // Kullanıcı "React'in var ama Docker'ın yok" bilgisini görmeli.
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("React ve Docker", "must", ["react", "docker"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })
    expect(sonuc.missingKeywords).toEqual(["docker"])
  })

  it("kavramsız gereksinim eksik sayılır", () => {
    // splitIntoConcepts her gereksinim için en az bir kavram üretiyor;
    // boş liste geçersiz bir durum ve savunma amaçlı eksik sayılıyor.
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Arayüz geliştirme", "must", [])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.yakin],
      conceptVectors: [],
    })
    expect(sonuc.requirements[0]!.status).toBe("missing")
  })

  it("tam kelime eşleşmesi anlamsal eşleşmeden daha çok katkı verir", () => {
    const kelime = score({
      profile: PROFILE,
      posting: ilan([gereksinim("React", "must", ["react"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      conceptVectors: [V.yakin],
    })
    const anlamsal = score(
      {
        profile: PROFILE,
        posting: ilan([gereksinim("Arayüz", "must", ["arayüz"])]),
        evidence: [kanit("React ile panel geliştirdim")],
        evidenceVectors: [V.orta],
        conceptVectors: [V.yakin],
      },
      { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 },
    )

    expect(kelime.requirements[0]!.confidence).toBe(1)
    expect(anlamsal.requirements[0]!.confidence).toBeLessThan(1)
    expect(anlamsal.requirements[0]!.method).toBe("semantic")
  })
})
