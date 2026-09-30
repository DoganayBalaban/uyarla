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
    getResumeFile: async () => ({ buffer: Buffer.from(""), filename: "cv.pdf" }),
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
    // Kod bölümlemesi başlıksız metinde ham metni her bloğa verdiği için
    // eğitim çağrısı da yapılıyor.
    resume_education: { education: [] },
    resume_skills: {
      lines: [{ label: "Beceriler", items: ["React"] }],
      languages: [],
      certifications: [],
    },
    job_posting_draft: POSTING_DRAFT,
    requirement_keywords: {
      items: [
        { text: "React deneyimi", concepts: [{ term: "react", synonyms: ["react"] }] },
      ],
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
  let call = 0
  return {
    modelId: "test-model",
    llm: fakeLlm(),
    embedding: { embed: async (texts) => texts.map(() => [1, 0]) },
    store: fakeStore(),
    now: () => (call++ === 0 ? 1000 : 4500),
    ...overrides,
  }
}

const INPUT = { resumeId: "r-1", jobPostingId: "j-1", userId: "u-1" }

describe("runAnalysis · happy path", () => {
  it("returns analysisId and completes the analysis", async () => {
    const completeAnalysis = vi.fn()
    const id = await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), INPUT)

    expect(id).toBe("an-1")
    expect(completeAnalysis).toHaveBeenCalledOnce()
    const arg = completeAnalysis.mock.calls[0]![0]
    expect(arg.analysisId).toBe("an-1")
    expect(arg.score).toBe(100)
  })

  it("saves the format report with the result", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), INPUT)
    const format = completeAnalysis.mock.calls[0]![0].format
    // "ham cv" metninde e-posta yok: kontrol çalışmış ve bunu bulmuş olmalı.
    expect(format.bulgular.map((b: { kod: string }) => b.kod)).toContain("eposta_yok")
  })

  it("completes the analysis even if the format check throws", async () => {
    const completeAnalysis = vi.fn()
    const store = fakeStore({
      completeAnalysis,
      getResumeFile: async () => {
        throw new Error("dosya yok")
      },
    })
    await runAnalysis(fakeDeps({ store }), INPUT)
    expect(completeAnalysis).toHaveBeenCalledOnce()
    expect(completeAnalysis.mock.calls[0]![0].format).toBeNull()
  })

  it("measures and saves the duration", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), INPUT)
    expect(completeAnalysis.mock.calls[0]![0].durationMs).toBe(3500)
  })

  it("sums and saves token counts", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), INPUT)
    // 3 CV çağrısı (deneyim, eğitim, beceri) + 1 ilan çağrısı × 10 token.
    // Bölümleme ve kavramlara ayırma artık kodda; ikisi de LLM çağrısı değil.
    expect(completeAnalysis.mock.calls[0]![0].tokenUsage).toBe(40)
  })

  it("reports stages in order", async () => {
    const stages: PipelineStage[] = []
    await runAnalysis(fakeDeps({ onProgress: (s) => stages.push(s) }), INPUT)
    expect(stages).toEqual([
      "cv_okunuyor", "ilan_okunuyor", "karsilastiriliyor", "tamamlandi",
    ])
  })

  it("saves the resume version and links it to the analysis", async () => {
    const saveResumeVersion = vi.fn().mockResolvedValue("rv-9")
    const attachResumeVersion = vi.fn()
    await runAnalysis(
      fakeDeps({ store: fakeStore({ saveResumeVersion, attachResumeVersion }) }),
      INPUT,
    )
    expect(saveResumeVersion).toHaveBeenCalledWith("r-1", expect.objectContaining({ skills: ["React"] }))
    expect(attachResumeVersion).toHaveBeenCalledWith("an-1", "rv-9")
  })

  it("saves the extracted posting data", async () => {
    const saveJobPostingData = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ saveJobPostingData }) }), INPUT)
    expect(saveJobPostingData).toHaveBeenCalledWith("j-1", expect.objectContaining({
      position: "Frontend Geliştirici",
    }))
  })

  it("embeds evidence and requirements in a single batch call", async () => {
    const embed = vi.fn().mockImplementation(async (texts: string[]) => texts.map(() => [1, 0]))
    await runAnalysis(fakeDeps({ embedding: { embed } }), INPUT)
    expect(embed).toHaveBeenCalledOnce()
  })
})

describe("runAnalysis · error handling", () => {
  it("marks the analysis with an error code on a permanent error and rethrows", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      llm: {
        async extract(): Promise<never> {
          throw new PermanentError("bozuk", "unreadable_file")
        },
      },
    })

    await expect(runAnalysis(deps, INPUT)).rejects.toBeInstanceOf(PermanentError)
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "unreadable_file")
  })

  it("also records a transient error and rethrows (so BullMQ retries)", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      embedding: {
        async embed(): Promise<number[][]> {
          throw new TransientError("erişilemedi", "embedding_unreachable")
        },
      },
    })

    await expect(runAnalysis(deps, INPUT)).rejects.toBeInstanceOf(TransientError)
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "embedding_unreachable")
  })

  it("records an unclassified error as unknown", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      llm: {
        async extract(): Promise<never> {
          throw new Error("beklenmeyen")
        },
      },
    })

    await expect(runAnalysis(deps, INPUT)).rejects.toThrow("beklenmeyen")
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "unknown")
  })

  it("does not hide the original error if recording it fails", async () => {
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

    await expect(runAnalysis(deps, INPUT)).rejects.toThrow("asıl sebep")
  })
})
