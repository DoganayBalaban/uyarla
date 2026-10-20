import { describe, expect, it } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { followUpSource, generateFollowUp } from "./followUp.js"

const PROFILE: ResumeProfile = {
  fullName: "Elif Yılmaz",
  headline: "Frontend Geliştirici",
  summary: null,
  experience: [
    { company: "Acme", title: "Frontend Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "React ile müşteri paneli geliştirdim", sourceRef: "React ile müşteri paneli geliştirdim" }] },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}

const POSTING = {
  position: "Frontend Geliştirici",
  company: "Beta",
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "React deneyimi", type: "skill", importance: "must", concepts: [{ term: "react", synonyms: [] }] },
    { text: "Kubernetes bilgisi", type: "skill", importance: "nice", concepts: [{ term: "kubernetes", synonyms: [] }] },
  ],
} as JobPostingData

const llm = (data: unknown): LlmProvider => ({ extract: async <T>() => ({ data: data as T, tokens: 12 }) })

describe("generateFollowUp (DOG-117)", () => {
  it("puts the given date into the verification source so it is not a made-up number", async () => {
    const { data } = await generateFollowUp(
      llm({ konu: "Frontend Geliştirici başvurum", metin: "Merhaba, 10 Ekim 2026'da Frontend Geliştirici pozisyonuna başvurdum. Acme'de React ile müşteri paneli geliştirdim. Süreç hakkında bilgi alabilir miyim? Elif Yılmaz" }),
      { profile: PROFILE, posting: POSTING, kind: "followup", channel: "email", date: "2026-10-10" },
    )
    expect(data.subject).toBe("Frontend Geliştirici başvurum")
    expect(data.verification.status).toBe("ok")
  })

  it("flags a claim that is not in the sent documents", async () => {
    const { data } = await generateFollowUp(
      llm({ konu: null, metin: "Merhaba, 5 yıllık Kubernetes deneyimimle katkı sağlayabilirim." }),
      { profile: PROFILE, posting: POSTING, kind: "followup", channel: "linkedin" },
    )
    expect(data.subject).toBeNull()
    expect(data.verification.status).toBe("flagged")
    expect(data.verification.issues.map((i) => i.detail).join(" ")).toMatch(/kubernetes|"5"/i)
  })

  it("uses the sent cover letter as a source too", () => {
    const source = followUpSource({ profile: PROFILE, posting: POSTING, kind: "thanks", channel: "email", coverLetter: ["Ön yazı paragrafı."], date: "2026-10-21" })
    expect(source).toContain("GÖNDERİLEN ÖN YAZI")
    expect(source).toContain("Mülakat tarihi: 21 Ekim 2026")
  })
})
