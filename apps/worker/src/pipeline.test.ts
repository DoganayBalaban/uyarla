import { describe, it, expect, vi } from "vitest"
import { PermanentError, TransientError } from "@uyarla/core"
import { runAnalysis } from "./pipeline.js"
import type { AnalysisStore, PipelineDeps, PipelineStage } from "./types.js"

const PROFILE = {
  fullName: "Elif", headline: null, summary: null,
  experience: [
    {
      company: "Acme", title: "Frontend Geliştirici",
      startDate: "2022", endDate: "halen",
      bullets: [{ text: "React ile panel geliştirdi", sourceRef: "React ile panel geliştirdi" }],
    },
  ],
  education: [], skills: ["React"], languages: [], certifications: [],
}

const POSTING_DRAFT = {
  position: "Frontend Geliştirici", company: "Acme", seniority: "mid", language: "tr",
  requirements: [{ text: "React deneyimi", type: "skill", importance: "must" }],
}

function fakeStore(overrides: Partial<AnalysisStore> = {}): AnalysisStore {
  return {
    getResumeText: async () => "ham cv",
    getJobPostingText: async () => "ham ilan",
    saveResumeVersion: async () => "rv-1",
    saveJobPostingData: async () => {},
    createAnalysis: async () => "an-1",
    attachResumeVersion: async () => {},
    completeAnalysis: async () => {},
    failAnalysis: async () => {},
    ...overrides,
  }
}

/** Şema adına göre yanıt veren sahte LLM; çağrı sırası da kaydediliyor. */
function fakeLlm(overrides: Record<string, unknown> = {}) {
  const calls: string[] = []
  const responses: Record<string, unknown> = {
    resume_segments: {
      summaryBlock: "", experienceBlock: "Acme...", educationBlock: "", skillsBlock: "React",
    },
    resume_experience: { experience: PROFILE.experience },
    resume_skills: {
      lines: [{ label: "Beceriler", items: ["React"] }],
      languages: [],
      certifications: [],
    },
    job_posting_draft: POSTING_DRAFT,
    requirement_keywords: {
      items: [{ text: "React deneyimi", keywords: ["react"] }],
    },
    ...overrides,
  }
  return {
    calls,
    async extract<T>(opts: { schemaName: string }) {
      calls.push(opts.schemaName)
      const data = responses[opts.schemaName]
      if (data === undefined) throw new Error(`beklenmeyen şema: ${opts.schemaName}`)
      return { data: data as T, tokens: 10 }
    },
  }
}

function fakeDeps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  let cagri = 0
  return {
    modelId: "test-model",
    llm: fakeLlm(),
    embedding: { embed: async (texts) => texts.map(() => [1, 0]) },
    store: fakeStore(),
    now: () => (cagri++ === 0 ? 1000 : 4500),
    ...overrides,
  }
}

const GIRDI = { resumeId: "r-1", jobPostingId: "j-1" }

describe("runAnalysis · mutlu yol", () => {
  it("analysisId döner ve analizi tamamlar", async () => {
    const completeAnalysis = vi.fn()
    const id = await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), GIRDI)

    expect(id).toBe("an-1")
    expect(completeAnalysis).toHaveBeenCalledOnce()
    const arg = completeAnalysis.mock.calls[0]![0]
    expect(arg.analysisId).toBe("an-1")
    expect(arg.score).toBe(100)
  })

  it("süreyi ölçüp kaydeder", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), GIRDI)
    expect(completeAnalysis.mock.calls[0]![0].durationMs).toBe(3500)
  })

  it("token sayılarını toplayıp kaydeder", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), GIRDI)
    // 3 CV çağrısı + 2 ilan çağrısı × 10 token
    expect(completeAnalysis.mock.calls[0]![0].tokenUsage).toBe(50)
  })

  it("aşamaları sırayla bildirir", async () => {
    const stages: PipelineStage[] = []
    await runAnalysis(fakeDeps({ onProgress: (s) => stages.push(s) }), GIRDI)
    expect(stages).toEqual([
      "cv_okunuyor", "ilan_okunuyor", "karsilastiriliyor", "tamamlandi",
    ])
  })

  it("CV sürümünü kaydedip analize bağlar", async () => {
    const saveResumeVersion = vi.fn().mockResolvedValue("rv-9")
    const attachResumeVersion = vi.fn()
    await runAnalysis(
      fakeDeps({ store: fakeStore({ saveResumeVersion, attachResumeVersion }) }),
      GIRDI,
    )
    expect(saveResumeVersion).toHaveBeenCalledWith("r-1", expect.objectContaining({ skills: ["React"] }))
    expect(attachResumeVersion).toHaveBeenCalledWith("an-1", "rv-9")
  })

  it("çıkarılmış ilan verisini kaydeder", async () => {
    const saveJobPostingData = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ saveJobPostingData }) }), GIRDI)
    expect(saveJobPostingData).toHaveBeenCalledWith("j-1", expect.objectContaining({
      position: "Frontend Geliştirici",
    }))
  })

  it("kanıtları ve gereksinimleri tek toplu embedding çağrısında gömer", async () => {
    const embed = vi.fn().mockImplementation(async (texts: string[]) => texts.map(() => [1, 0]))
    await runAnalysis(fakeDeps({ embedding: { embed } }), GIRDI)
    expect(embed).toHaveBeenCalledOnce()
  })
})

describe("runAnalysis · hata yönetimi", () => {
  it("kalıcı hatada analizi hata koduyla işaretler ve yeniden fırlatır", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      llm: {
        async extract(): Promise<never> {
          throw new PermanentError("bozuk", "unreadable_file")
        },
      },
    })

    await expect(runAnalysis(deps, GIRDI)).rejects.toBeInstanceOf(PermanentError)
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "unreadable_file")
  })

  it("geçici hatayı da kaydeder ve yeniden fırlatır (BullMQ tekrar denesin)", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      embedding: {
        async embed(): Promise<number[][]> {
          throw new TransientError("erişilemedi", "embedding_unreachable")
        },
      },
    })

    await expect(runAnalysis(deps, GIRDI)).rejects.toBeInstanceOf(TransientError)
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "embedding_unreachable")
  })

  it("sınıflandırılmamış hatayı unknown olarak kaydeder", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      llm: {
        async extract(): Promise<never> {
          throw new Error("beklenmeyen")
        },
      },
    })

    await expect(runAnalysis(deps, GIRDI)).rejects.toThrow("beklenmeyen")
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "unknown")
  })

  it("hata kaydı da başarısız olursa asıl hatayı gizlemez", async () => {
    // Asıl hatanın üstünü örten bir hata, teşhisi imkânsız kılar.
    const deps = fakeDeps({
      store: fakeStore({
        failAnalysis: async () => {
          throw new Error("veritabanı da düştü")
        },
      }),
      llm: {
        async extract(): Promise<never> {
          throw new PermanentError("asıl sebep", "unreadable_file")
        },
      },
    })

    await expect(runAnalysis(deps, GIRDI)).rejects.toThrow("asıl sebep")
  })
})
