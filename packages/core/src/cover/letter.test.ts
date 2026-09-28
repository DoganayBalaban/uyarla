import { describe, expect, it } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { cvOlgulari, generateCoverLetter, verifyCoverLetter } from "./letter.js"

const PROFIL: ResumeProfile = {
  fullName: "Elif Yılmaz",
  headline: "Frontend Geliştirici",
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Frontend Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [{ text: "React ile panel geliştirdi", sourceRef: "React ile müşteri paneli geliştirdim" }],
    },
  ],
  education: [
    { school: "İstanbul Üniversitesi", degree: "Lisans", field: "Bilgisayar", startDate: null, endDate: "2021" },
  ],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce"],
  certifications: [],
}

const ILAN: JobPostingData = {
  position: "Kıdemli Frontend Geliştirici",
  company: "Beta",
  seniority: "senior",
  language: "tr",
  requirements: [
    { text: "React deneyimi", type: "skill", importance: "must", concepts: [{ term: "react", synonyms: [] }] },
    { text: "Kubernetes bilgisi", type: "skill", importance: "nice", concepts: [{ term: "kubernetes", synonyms: ["k8s"] }] },
  ],
} as JobPostingData

describe("cvOlgulari", () => {
  it("modele ve kontrole giden metin CV'deki olguları içeriyor", () => {
    const m = cvOlgulari(PROFIL)
    expect(m).toContain("Frontend Geliştirici — Acme (2022 – halen)")
    // Madde metninin CV'deki birebir karşılığı kullanılıyor.
    expect(m).toContain("React ile müşteri paneli geliştirdim")
    expect(m).toContain("Beceriler: React, TypeScript")
  })
})

describe("verifyCoverLetter", () => {
  const kaynak = cvOlgulari(PROFIL)

  it("CV'ye dayanan paragraf temiz", () => {
    const [p] = verifyCoverLetter(["2022'den beri Acme'de React ile müşteri paneli geliştiriyorum."], kaynak, ILAN)
    expect(p!.kontrol.status).toBe("ok")
  })

  it("CV'de olmayan ilan kavramını ve sayıyı işaretliyor", () => {
    const [p] = verifyCoverLetter(["5 yıldır Kubernetes ile çalışıyorum."], kaynak, ILAN)
    expect(p!.kontrol.status).toBe("flagged")
    const detaylar = p!.kontrol.issues.map((i) => i.detail)
    expect(detaylar).toEqual(
      expect.arrayContaining([
        'Bu paragrafta "5" sayısı geçiyor ama CV\'nde yok.',
        'Bu paragrafta "kubernetes" geçiyor ama CV\'nde yok.',
      ]),
    )
  })
})

describe("generateCoverLetter", () => {
  it("modelin paragraflarını temizleyip kontrol ediyor", async () => {
    let gorulen = ""
    const llm: LlmProvider = {
      async extract<T>(opts: { input: string; schemaName: string }) {
        gorulen = opts.input
        return {
          data: { paragraflar: ["  Başvuruyorum.  ", "", "Kubernetes deneyimim var."] } as T,
          tokens: 42,
        }
      },
    }
    const { data, tokens } = await generateCoverLetter(llm, { profile: PROFIL, posting: ILAN })

    expect(tokens).toBe(42)
    expect(data.paragraflar.map((p) => p.metin)).toEqual(["Başvuruyorum.", "Kubernetes deneyimim var."])
    expect(data.paragraflar[1]!.kontrol.status).toBe("flagged")
    // Model hem CV'yi hem ilanın gereksinimlerini görüyor.
    expect(gorulen).toContain("CV BİLGİLERİ")
    expect(gorulen).toContain("Zorunlu gereksinimler:\n- React deneyimi")
  })
})
