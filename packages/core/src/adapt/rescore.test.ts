import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { rescore } from "./rescore.js"

const resumeProfile: ResumeProfile = {
  fullName: "Test", headline: null, summary: null,
  experience: [
    {
      company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen",
      bullets: [{ text: "panel yaptım", sourceRef: "panel yaptım" }],
    },
  ],
  education: [], skills: [], languages: [], certifications: [],
}

const testPosting: JobPostingData = {
  position: "Geliştirici", company: null, seniority: null, language: "tr",
  requirements: [
    {
      text: "React deneyimi", type: "skill", importance: "must",
      concepts: [{ term: "React", synonyms: [] }],
    },
  ],
}

const draftData: AdaptationDraft = {
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
function orthogonalEmbedding(): EmbeddingProvider {
  return {
    embed: vi.fn(async (t: string[]) =>
      t.map((_, i) => t.map((__, j) => (i === j ? 1 : 0))),
    ),
  }
}

let embedding: EmbeddingProvider
beforeEach(() => {
  embedding = orthogonalEmbedding()
})

describe("rescore", () => {
  it("reflects a match gained by an accepted rewrite in the score", async () => {
    const fresh = await rescore({ profile: resumeProfile, posting: testPosting, draft: draftData }, embedding)
    expect(fresh).toBeGreaterThan(0)
  })

  it("an unaccepted rewrite does not count toward the score", async () => {
    const red: AdaptationDraft = {
      ...draftData,
      bullets: [{ ...draftData.bullets[0]!, decision: "rejected" }],
    }
    expect(await rescore({ profile: resumeProfile, posting: testPosting, draft: red }, embedding)).toBe(0)
  })

  it("makes no new LLM call", async () => {
    // spec §10: çıkarım zaten yapılmış, yalnızca kanıt kümesi değişiyor.
    // rescore bir LlmProvider bile almıyor; bu test o sözleşmeyi sabitliyor.
    await rescore({ profile: resumeProfile, posting: testPosting, draft: draftData }, embedding)
    expect(embedding.embed).toHaveBeenCalledTimes(1)
  })
})
