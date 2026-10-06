import { describe, it, expect, vi, beforeEach } from "vitest"
import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { guardSummaryScore, rescore } from "./rescore.js"

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

describe("guardSummaryScore", () => {
  // Yerel deneme (6 Ekim 2026): terimleri koruyan özet bile cümleleri
  // değiştirdiği için zayıf anlamsal eşleşmeleri kaybettirip skoru 47 → 45
  // düşürüyordu. Kullanıcı kararı: düşürüyorsa özgün özet kalır.
  const withSummary: ResumeProfile = { ...resumeProfile, summary: "React ile arayüz geliştiren yazılımcı." }
  const summaryDraft = (rewritten: string): AdaptationDraft => ({
    ...draftData,
    bullets: [{ ...draftData.bullets[0]!, decision: "rejected" }],
    summary: { original: withSummary.summary, rewritten, verification: { status: "ok", issues: [] }, decision: "accepted" },
  })

  it("keeps the original summary when the rewrite lowers the score", async () => {
    const draft = summaryDraft("Arayüz geliştiren yazılımcı.")
    const guarded = await guardSummaryScore({ profile: withSummary, posting: testPosting, draft }, embedding)
    expect(guarded.draft.summary.rewritten).toBe(withSummary.summary)
    expect(guarded.dropped!.withRewrite).toBeLessThan(guarded.dropped!.withOriginal)
  })

  it("keeps a rewrite that does not lower the score", async () => {
    const draft = summaryDraft("React ile kullanıcı arayüzleri geliştiren yazılımcı.")
    const guarded = await guardSummaryScore({ profile: withSummary, posting: testPosting, draft }, embedding)
    expect(guarded.draft.summary.rewritten).toBe("React ile kullanıcı arayüzleri geliştiren yazılımcı.")
    expect(guarded.dropped).toBeNull()
  })

  it("scores both versions from a single embedding call", async () => {
    // OpenAI gömmeleri çağrıdan çağrıya ~1e-2 oynuyor; iki ayrı çağrı eşiğe
    // yakın eşleşmeyi bir tarafta kazandırıp diğerinde kaybettirebilir.
    const draft = summaryDraft("Arayüz geliştiren yazılımcı.")
    await guardSummaryScore({ profile: withSummary, posting: testPosting, draft }, embedding)
    expect(embedding.embed).toHaveBeenCalledTimes(1)
  })

  it("does nothing when the summary was not rewritten", async () => {
    const draft = summaryDraft(withSummary.summary!)
    const guarded = await guardSummaryScore({ profile: withSummary, posting: testPosting, draft }, embedding)
    expect(guarded.draft).toBe(draft)
    expect(embedding.embed).not.toHaveBeenCalled()
  })
})

