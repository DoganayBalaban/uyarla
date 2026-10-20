import { describe, expect, it } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { consistencySummary, generateInterviewPrep } from "./prep.js"

const PROFILE: ResumeProfile = {
  fullName: "Elif",
  headline: null,
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Frontend Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile müşteri paneli geliştirdim", sourceRef: "React ile müşteri paneli geliştirdim" },
        { text: "Sayfa yükleme süresini %40 kısalttım", sourceRef: "Sayfa yükleme süresini %40 kısalttım" },
      ],
    },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}

const POSTING = {
  position: "Frontend Geliştirici",
  company: "Beta",
  seniority: null,
  language: "tr",
  requirements: [
    { text: "React deneyimi", type: "skill", importance: "must", concepts: [{ term: "react", synonyms: [] }] },
    { text: "Kubernetes bilgisi", type: "skill", importance: "must", concepts: [{ term: "kubernetes", synonyms: [] }] },
  ],
} as JobPostingData

const llm = (data: unknown): LlmProvider => ({ extract: async <T>() => ({ data: data as T, tokens: 9 }) })

describe("consistencySummary (DOG-118)", () => {
  it("lists rewritten bullets first, then bullets carrying numbers", () => {
    expect(consistencySummary(PROFILE, ["React ile müşteri paneli geliştirdim", "CV'de olmayan madde"])).toEqual([
      { claim: "React ile müşteri paneli geliştirdim", reason: "rewritten" },
      { claim: "Sayfa yükleme süresini %40 kısalttım", reason: "quantity" },
    ])
  })
})

describe("generateInterviewPrep (DOG-118)", () => {
  const answer = {
    sorular: [
      {
        soru: "Performans iyileştirmesini anlatır mısın?",
        tur: "davranissal",
        neden: "CV'nde %40 iyileştirme var.",
        kanit: ["Sayfa yükleme süresini %40 kısalttım", "Uydurma bir madde"],
        star: { durum: "[proje bağlamı]", gorev: "Sayfa yükleme süresini kısaltmak", eylem: "[ne yaptın]", sonuc: "%40 kısalttım" },
      },
      {
        soru: "Ekip yönettin mi?",
        tur: "bosluk",
        neden: "İlan liderlik istiyor.",
        kanit: [],
        star: { durum: "8 kişilik ekip", gorev: "[görev]", eylem: "[eylem]", sonuc: "[sonuç]" },
      },
    ],
    kopruler: [{ gereksinim: "Kubernetes bilgisi", cevap: "Kubernetes ile doğrudan çalışmadım; ancak React ile müşteri paneli geliştirdim." }],
    sorulacaklar: ["Ekip nasıl çalışıyor?", "İlk 3 ayda beklenti ne?", "Kod inceleme süreci?", "Fazla soru"],
  }

  it("keeps only evidence that is literally in the CV and flags a made-up number", async () => {
    const { data } = await generateInterviewPrep(llm(answer), { profile: PROFILE, posting: POSTING, missingMust: ["Kubernetes bilgisi"] })
    expect(data.questions[0]!.evidence).toEqual(["Sayfa yükleme süresini %40 kısalttım"])
    expect(data.questions[0]!.verification.status).toBe("ok")
    expect(data.questions[1]!.kind).toBe("gap")
    expect(data.questions[1]!.verification.status).toBe("flagged")
    expect(data.askThem).toHaveLength(3)
  })

  it("does not flag a negated duration from the posting, but flags a claimed one", async () => {
    const bridges = { ...answer, kopruler: [
      { gereksinim: "En az 5 yıl Kubernetes", cevap: "Kubernetes ile 5 yıl deneyimim yok; ancak React ile müşteri paneli geliştirdim." },
      { gereksinim: "Kubernetes", cevap: "4 yıllık React deneyimim var." },
    ] }
    const { data } = await generateInterviewPrep(llm(bridges), { profile: PROFILE, posting: POSTING, missingMust: [] })
    expect(data.bridges.map((b) => b.verification.status)).toEqual(["ok", "flagged"])
  })

  it("does not flag an honest bridge", async () => {
    const { data } = await generateInterviewPrep(llm(answer), { profile: PROFILE, posting: POSTING, missingMust: ["Kubernetes bilgisi"] })
    expect(data.bridges[0]!.verification.status).toBe("ok")
    expect(data.consistency).toEqual([{ claim: "Sayfa yükleme süresini %40 kısalttım", reason: "quantity" }])
  })
})
