import { describe, expect, it } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { resumeFacts, generateCoverLetter, verifyCoverLetter } from "./letter.js"

const TEST_PROFILE: ResumeProfile = {
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

const POSTING: JobPostingData = {
  position: "Kıdemli Frontend Geliştirici",
  company: "Beta",
  seniority: "senior",
  language: "tr",
  requirements: [
    { text: "React deneyimi", type: "skill", importance: "must", concepts: [{ term: "react", synonyms: [] }] },
    { text: "Kubernetes bilgisi", type: "skill", importance: "nice", concepts: [{ term: "kubernetes", synonyms: ["k8s"] }] },
  ],
} as JobPostingData

describe("resumeFacts", () => {
  it("the text given to the model and verification contains the resume facts", () => {
    const m = resumeFacts(TEST_PROFILE)
    expect(m).toContain("Frontend Geliştirici — Acme (2022 – halen)")
    // Madde metninin CV'deki birebir karşılığı kullanılıyor.
    expect(m).toContain("React ile müşteri paneli geliştirdim")
    expect(m).toContain("Beceriler: React, TypeScript")
  })
})

describe("verifyCoverLetter", () => {
  const sourceText = resumeFacts(TEST_PROFILE)

  it("a paragraph grounded in the resume is clean", () => {
    const [p] = verifyCoverLetter(["2022'den beri Acme'de React ile müşteri paneli geliştiriyorum."], sourceText, POSTING)
    expect(p!.verification.status).toBe("ok")
  })

  it("flags a posting concept and a number not in the resume", () => {
    const [p] = verifyCoverLetter(["5 yıldır Kubernetes ile çalışıyorum."], sourceText, POSTING)
    expect(p!.verification.status).toBe("flagged")
    const details = p!.verification.issues.map((i) => i.detail)
    expect(details).toEqual(
      expect.arrayContaining([
        'Bu paragrafta "5" sayısı geçiyor ama CV\'nde yok.',
        'Bu paragrafta "kubernetes" geçiyor ama CV\'nde yok.',
      ]),
    )
  })
})

describe("generateCoverLetter", () => {
  it("cleans and verifies the model's paragraphs", async () => {
    let seen = ""
    const llm: LlmProvider = {
      async extract<T>(opts: { input: string; schemaName: string }) {
        seen = opts.input
        return {
          data: { paragraflar: ["  Başvuruyorum.  ", "", "Kubernetes deneyimim var."] } as T,
          tokens: 42,
        }
      },
    }
    const { data, tokens } = await generateCoverLetter(llm, { profile: TEST_PROFILE, posting: POSTING })

    expect(tokens).toBe(42)
    expect(data.paragraphs.map((p) => p.text)).toEqual(["Başvuruyorum.", "Kubernetes deneyimim var."])
    expect(data.paragraphs[1]!.verification.status).toBe("flagged")
    // Model hem CV'yi hem ilanın gereksinimlerini görüyor.
    expect(seen).toContain("CV BİLGİLERİ")
    expect(seen).toContain("Zorunlu gereksinimler:\n- React deneyimi")
  })
})
