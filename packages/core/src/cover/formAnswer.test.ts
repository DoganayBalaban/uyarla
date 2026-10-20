import { describe, expect, it, vi } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { cutToLimit, generateFormAnswer, questionLanguage } from "./formAnswer.js"

const profile: ResumeProfile = {
  fullName: "Ayşe Yılmaz",
  headline: "Frontend Geliştirici",
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Frontend Geliştirici",
      startDate: "2021",
      endDate: "halen",
      bullets: [{ text: "React ile müşteri panelini geliştirdim, açılış süresini %30 kısalttım", sourceRef: "React ile müşteri panelini geliştirdim, açılış süresini %30 kısalttım" }],
    },
  ],
  education: [],
  skills: ["React", "TypeScript"],
  languages: [],
  certifications: [],
}
const posting = { position: "Frontend Geliştirici", company: "Beta", seniority: "mid", language: "tr", requirements: [] } as unknown as JobPostingData
const llmReturning = (...answers: string[]) => {
  const extract = vi.fn()
  for (const a of answers) extract.mockResolvedValueOnce({ data: { yanit: a }, tokens: 10 })
  return { extract }
}

describe("generateFormAnswer (DOG-123)", () => {
  it("answers within the limit and checks it like a cover letter", async () => {
    const llm = llmReturning("React ile müşteri panelini geliştirdim ve açılış süresini %30 kısalttım.")
    const { data } = await generateFormAnswer(llm as never, { profile, posting, question: "Neden sen?", limit: { unit: "chars", max: 140 } })
    expect(data).toMatchObject({ overLimit: false, verification: { status: "ok" } })
    expect(llm.extract).toHaveBeenCalledTimes(1)
    expect(llm.extract.mock.calls[0]![0].input).toContain("SINIR: en fazla 140 karakter")
  })

  it("flags a number that is not in the documents", async () => {
    const llm = llmReturning("Açılış süresini %60 kısalttım.")
    const { data } = await generateFormAnswer(llm as never, { profile, posting, question: "Başarın?", limit: null })
    expect(data.verification.status).toBe("flagged")
  })

  it("asks once to shorten, then cuts at the last whole sentence", async () => {
    const long = "React ile panel geliştirdim. Açılış süresini %30 kısalttım. TypeScript kullanıyorum ve test yazıyorum."
    const llm = llmReturning(long, long)
    const { data } = await generateFormAnswer(llm as never, { profile, posting, question: "Kısaca?", limit: { unit: "words", max: 9 } })
    expect(llm.extract).toHaveBeenCalledTimes(2)
    expect(llm.extract.mock.calls[1]![0].input).toContain("SINIR 9")
    expect(data.text).toBe("React ile panel geliştirdim. Açılış süresini %30 kısalttım.")
    expect(data.overLimit).toBe(false)
  })

  it("keeps an answer whose first sentence is already too long and says so", async () => {
    const long = "React ve TypeScript ile müşteri panelini baştan sona geliştirdim"
    const llm = llmReturning(long, long)
    const { data } = await generateFormAnswer(llm as never, { profile, posting, question: "?", limit: { unit: "chars", max: 50 } })
    expect(data).toMatchObject({ text: long, overLimit: true })
  })
})

describe("cutToLimit", () => {
  it("cuts at sentence ends only", () => {
    expect(cutToLimit("Bir. İki üç. Dört beş altı.", { unit: "words", max: 3 })).toBe("Bir. İki üç.")
    expect(cutToLimit("Tek uzun cümle burada", { unit: "words", max: 2 })).toBeNull()
  })
})

describe("questionLanguage", () => {
  it("reads the question's language, not the posting's", () => {
    expect(questionLanguage("Neden sizi seçmeliyiz?")).toBe("tr")
    expect(questionLanguage("Kendinizi tanıtır mısınız?")).toBe("tr")
    expect(questionLanguage("Why do you want to work with us?")).toBe("en")
    expect(questionLanguage("Tell us about a project you are proud of.")).toBe("en")
  })
})
