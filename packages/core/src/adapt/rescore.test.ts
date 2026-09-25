import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { rescore } from "./rescore.js"

const profil: ResumeProfile = {
  fullName: "Test", headline: null, summary: null,
  experience: [
    {
      company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen",
      bullets: [{ text: "panel yaptım", sourceRef: "panel yaptım" }],
    },
  ],
  education: [], skills: [], languages: [], certifications: [],
}

const ilan: JobPostingData = {
  position: "Geliştirici", company: null, seniority: null, language: "tr",
  requirements: [
    {
      text: "React deneyimi", type: "skill", importance: "must",
      concepts: [{ term: "React", synonyms: [] }],
    },
  ],
}

const taslak: AdaptationDraft = {
  summary: {
    original: null, rewritten: "", verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: "0-0", experienceIndex: 0, original: "panel yaptım", sourceRef: "panel yaptım",
      rewritten: "React ile panel yaptım", verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
  ],
  skillOrder: [],
}

/**
 * Her metne kendi birim vektörünü verir: tüm çiftler dik, benzerlik 0.
 * Anlamsal katman böylece devre dışı kalır ve skoru yalnızca kelime
 * eşleşmesi belirler.
 */
function dikEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn(async (t: string[]) =>
      t.map((_, i) => t.map((__, j) => (i === j ? 1 : 0))),
    ),
  }
}

let embedding: EmbeddingProvider
beforeEach(() => {
  embedding = dikEmbedding()
})

describe("rescore", () => {
  it("kabul edilen yeniden yazımla kazanılan eşleşmeyi skora yansıtır", async () => {
    const yeni = await rescore({ profile: profil, posting: ilan, draft: taslak }, embedding)
    expect(yeni).toBeGreaterThan(0)
  })

  it("kabul edilmemiş yeniden yazım skora girmez", async () => {
    const red: AdaptationDraft = {
      ...taslak,
      bullets: [{ ...taslak.bullets[0]!, decision: "rejected" }],
    }
    expect(await rescore({ profile: profil, posting: ilan, draft: red }, embedding)).toBe(0)
  })

  it("yeni LLM çağrısı yapmaz", async () => {
    // spec §10: çıkarım zaten yapılmış, yalnızca kanıt kümesi değişiyor.
    // rescore bir LlmProvider bile almıyor; bu test o sözleşmeyi sabitliyor.
    await rescore({ profile: profil, posting: ilan, draft: taslak }, embedding)
    expect(embedding.embed).toHaveBeenCalledTimes(1)
  })
})
