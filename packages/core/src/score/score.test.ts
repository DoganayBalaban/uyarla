import { describe, it, expect } from "vitest"
import { score } from "./score.js"
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

const gereksinim = (
  text: string,
  importance: "must" | "nice",
  keywords: string[],
): Requirement => ({ text, type: "skill", importance, keywords })

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
      requirementVectors: [V.yakin],
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
      requirementVectors: [V.yakin],
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
      requirementVectors: [V.yakin],
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
      requirementVectors: [V.yakin],
    })
    expect(sonuc.requirements[0]!.evidence!.text).toBe("en yakın madde")
  })

  it("eşiğin altındaki benzerlik eksik sayılır ve kanıt gösterilmez", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("Kubernetes", "must", ["kubernetes"])]),
      evidence: [kanit("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      requirementVectors: [V.yakin],
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
      requirementVectors: [],
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
      requirementVectors: [V.yakin],
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
      requirementVectors: [V.yakin, V.yakin],
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
      requirementVectors: [V.yakin, V.yakin],
    })
    // (2.0 × 0 + 1.0 × 1.0) / 3.0 = 0.333 → 33
    expect(sonuc.score).toBe(33)
  })

  it("anlamsal eşleşmede güven benzerlik değeridir, 1.0 değil", () => {
    const sonuc = score(
      {
        profile: PROFILE,
        posting: ilan([gereksinim("Arayüz", "must", ["yok"])]),
        evidence: [kanit("madde")],
        evidenceVectors: [V.orta],
        requirementVectors: [V.yakin],
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
      evidence: [], evidenceVectors: [], requirementVectors: [],
    })
    expect(sonuc.score).toBe(0)
    expect(sonuc.requirements).toEqual([])
  })

  it("CV'de hiç kanıt yoksa her gereksinim eksik olur", () => {
    const sonuc = score({
      profile: PROFILE,
      posting: ilan([gereksinim("React", "must", ["react"])]),
      evidence: [], evidenceVectors: [], requirementVectors: [V.yakin],
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
      requirementVectors: [V.yakin, V.yakin],
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
      requirementVectors: [V.yakin, V.yakin],
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
      requirementVectors: [V.yakin],
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
      requirementVectors: [V.yakin, V.yakin],
    }

    // must ve nice eşit ağırlıkta olsaydı: (1 + 0) / 2 = %50
    expect(score(girdi, { ...DEFAULT_SCORING_CONFIG, mustWeight: 1 }).score).toBe(50)
  })
})
