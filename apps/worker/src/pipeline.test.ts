import { describe, it, expect, vi } from "vitest"
import { PermanentError, TransientError, resumeParserKey } from "@uyarla/core"
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
    findParsedVersion: async () => null,
    saveResumeVersion: async () => "rv-1",
    saveJobPostingData: async () => {},
    createAnalysis: async () => "an-1",
    attachResumeVersion: async () => {},
    completeAnalysis: async () => {},
    failAnalysis: async () => {},
    getExcludedConceptKeys: async () => [],
    getRememberedFacts: async () => [],
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
    expect(format.findings.map((b: { code: string }) => b.code)).toContain("email_missing")
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

  it("skips the format check for a pasted CV (DOG-101)", async () => {
    const completeAnalysis = vi.fn()
    const getResumeFile = async () => ({ buffer: Buffer.from("ham cv"), filename: "/depo/abc.txt" })
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis, getResumeFile }) }), INPUT)
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
      "reading_resume", "reading_posting", "comparing", "completed",
    ])
  })

  it("saves the resume version and links it to the analysis", async () => {
    const saveResumeVersion = vi.fn().mockResolvedValue("rv-9")
    const attachResumeVersion = vi.fn()
    await runAnalysis(
      fakeDeps({ store: fakeStore({ saveResumeVersion, attachResumeVersion }) }),
      INPUT,
    )
    expect(saveResumeVersion).toHaveBeenCalledWith(
      "r-1",
      expect.objectContaining({ skills: ["React"] }),
      resumeParserKey("test-model"),
    )
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

describe("runAnalysis · saved resume (DOG-59)", () => {
  it("reuses a profile parsed with the same key instead of calling the model", async () => {
    const findParsedVersion = vi.fn().mockResolvedValue({ id: "rv-old", profile: PROFILE })
    const saveResumeVersion = vi.fn()
    const attachResumeVersion = vi.fn()
    const completeAnalysis = vi.fn()
    const llm = fakeLlm()

    await runAnalysis(
      fakeDeps({
        llm,
        store: fakeStore({ findParsedVersion, saveResumeVersion, attachResumeVersion, completeAnalysis }),
      }),
      INPUT,
    )

    expect(findParsedVersion).toHaveBeenCalledWith("r-1", resumeParserKey("test-model"))
    expect(llm.calls.filter((c) => c.startsWith("resume_"))).toEqual([])
    expect(saveResumeVersion).not.toHaveBeenCalled()
    expect(attachResumeVersion).toHaveBeenCalledWith("an-1", "rv-old")
    // Yalnızca ilan çağrısı.
    expect(completeAnalysis.mock.calls[0]![0].tokenUsage).toBe(10)
  })
})

describe("runAnalysis · timing (DOG-28)", () => {
  it("reads the resume and the posting at the same time", async () => {
    let inFlight = 0
    let peak = 0
    const base = fakeLlm()
    const llm = {
      async extract<T>(opts: { schemaName: string }) {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        return base.extract<T>(opts)
      },
    }

    await runAnalysis(fakeDeps({ llm }), INPUT)

    // Üç CV bloğu ve ilan aynı anda.
    expect(peak).toBe(4)
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

describe("runAnalysis · kalıcı hariç tutma (DOG-90)", () => {
  it("marks requirements whose concepts are all on the user's list", async () => {
    const completeAnalysis = vi.fn()
    const getExcludedConceptKeys = vi.fn(async () => ["react"])
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis, getExcludedConceptKeys }) }), INPUT)
    expect(getExcludedConceptKeys).toHaveBeenCalledWith("u-1")
    const arg = completeAnalysis.mock.calls[0]![0]
    expect(arg.result.excluded).toEqual([0])
    expect(arg.result.exclusions).toEqual({ 0: { reason: "irrelevant", scope: "profile" } })
    // İlk skor sonucun içinde kalıyor; Analysis.score düzeltilmiş (K-67).
    expect(arg.score).not.toBe(arg.result.score)
  })

  it("leaves the analysis alone when the list does not cover a requirement", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(
      fakeDeps({ store: fakeStore({ completeAnalysis, getExcludedConceptKeys: async () => ["vue"] }) }),
      INPUT,
    )
    const arg = completeAnalysis.mock.calls[0]![0]
    expect(arg.result.excluded).toBeUndefined()
    expect(arg.score).toBe(arg.result.score)
  })
})

describe("runAnalysis · olgu hafızası (DOG-116)", () => {
  const llm = () =>
    fakeLlm({
      job_posting_draft: { ...POSTING_DRAFT, requirements: [{ text: "Docker deneyimi", type: "skill", importance: "must" }] },
      requirement_keywords: { items: [{ text: "Docker deneyimi", concepts: [{ term: "Docker", synonyms: [] }] }] },
    })
  const fact = {
    id: "ad-1:c-1",
    company: "Acme",
    title: "Frontend Geliştirici",
    text: "Uygulamayı Docker Compose ile ayağa kaldırdım.",
    answer: "docker compose ile ayağa kaldırdım",
    requirement: "Docker deneyimi",
    createdAt: "2026-10-01T00:00:00.000Z",
  }

  it("counts a remembered fact as evidence and records it on the result", async () => {
    const completeAnalysis = vi.fn()
    const getRememberedFacts = vi.fn(async () => [fact])
    await runAnalysis(fakeDeps({ llm: llm(), store: fakeStore({ completeAnalysis, getRememberedFacts }) }), INPUT)
    expect(getRememberedFacts).toHaveBeenCalledWith("u-1")
    const { result } = completeAnalysis.mock.calls[0]![0]
    expect(result.requirements[0].status).toBe("matched")
    expect(result.requirements[0].evidence).toMatchObject({ sourceRef: fact.answer, fact: true })
    expect(result.facts).toEqual([fact])
  })

  it("leaves out a fact whose job is not on this CV", async () => {
    const completeAnalysis = vi.fn()
    const store = fakeStore({ completeAnalysis, getRememberedFacts: async () => [{ ...fact, company: "Başka Şirket" }] })
    await runAnalysis(fakeDeps({ llm: llm(), store }), INPUT)
    const { result } = completeAnalysis.mock.calls[0]![0]
    expect(result.requirements[0].status).toBe("missing")
    expect(result.facts).toBeUndefined()
  })
})
