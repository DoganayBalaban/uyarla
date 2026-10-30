import { describe, expect, it, vi } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { offPaperClaims, reviewAnswer } from "./practice.js"

const PROFILE: ResumeProfile = {
  fullName: null,
  headline: null,
  summary: null,
  experience: [
    { company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "Sayfa yükleme süresini %40 kısalttım", sourceRef: "Sayfa yükleme süresini %40 kısalttım" }] },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}
const POSTING = {
  position: "Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [{ text: "Kubernetes", type: "skill", importance: "must", concepts: [{ term: "kubernetes", synonyms: [] }] }],
} as JobPostingData

const llm: LlmProvider = {
  extract: async <T>() => ({
    data: { star: { durum: true, gorev: false, eylem: true, sonuc: true }, guclu: ["Sonucu sayıyla verdin."], gelistir: ["Senin payın neydi?"] } as T,
    tokens: 4,
  }),
}

describe("reviewAnswer (DOG-97)", () => {
  it("combines the model's STAR reading with length and off-paper claims from code", async () => {
    const answer = "Acme'de sayfa yükleme süresi uzundu. Görsel sıkıştırma ve önbellek ekledim, süreyi %40 kısalttım; 8 kişilik ekibi de yönettim."
    const { data } = await reviewAnswer(llm, { question: "Performans?", answer, profile: PROFILE, posting: POSTING })
    expect(data.star).toEqual({ situation: true, task: false, action: true, result: true })
    expect(data.length).toBe("short")
    expect(data.offPaper).toEqual(['Cevabında "8" sayısı geçiyor ama CV\'nde yok; sorulursa kanıtlayabilmelisin.'])
  })

  it("lists a quantity written in words that the CV does not have (DOG-166)", () => {
    expect(offPaperClaims("Satışları iki katına çıkardım.", "CV\nSatışları artırdım.", POSTING)).toEqual([
      'Cevabında "iki katına" geçiyor ama CV\'nde yok; sorulursa kanıtlayabilmelisin.',
    ])
  })

  it("tells the model which claims are off paper so it does not praise them", async () => {
    // Kullanıcı testi: geri bildirim CV'de olmayan "iki katına"yı ölçülebilir sonuç diye övdü.
    const extract = vi.fn(llm.extract)
    await reviewAnswer({ extract: extract as LlmProvider["extract"] }, { question: "Başarın?", answer: "Satışları iki katına çıkardım.", profile: PROFILE, posting: POSTING })
    const call = extract.mock.calls[0]![0]
    expect(call.input).toContain('"iki katına"')
    expect(call.prompt).toMatch(/CV'DE OLMAYAN/)
  })

  it("does not list a negated posting term as off-paper", () => {
    expect(offPaperClaims("Kubernetes ile doğrudan çalışmadım; React kullandım.", "CV\nReact", POSTING)).toEqual([])
    expect(offPaperClaims("Kubernetes kümesini yönettim.", "CV\nReact", POSTING)).toHaveLength(1)
  })
})
