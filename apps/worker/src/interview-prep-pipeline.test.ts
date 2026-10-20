import { describe, expect, it, vi } from "vitest"
import type { InterviewPrepContext, InterviewPrepStore } from "./follow-up-store.js"
import { runInterviewPrep } from "./interview-prep-pipeline.js"

const context = (status: "running" | "done" | null): InterviewPrepContext => ({
  profile: { fullName: null, headline: null, summary: null, experience: [], education: [], skills: [], languages: [], certifications: [] },
  coverLetter: [],
  posting: { position: "X", company: null, seniority: null, language: "tr", requirements: [] },
  missingMust: [],
  rewritten: [],
  record: status ? ({ status, createdAt: "2026-10-20T10:00:00Z", attempts: 1, ...(status === "done" ? { prep: {} } : {}) } as never) : null,
})

const llm = { extract: vi.fn(async () => ({ data: { sorular: [], kopruler: [], sorulacaklar: ["Ekip?"] }, tokens: 3 })) }

describe("runInterviewPrep (DOG-118)", () => {
  it("fills a running record", async () => {
    const savePrep = vi.fn(async () => {})
    const store: InterviewPrepStore = { getPrepContext: async () => context("running"), savePrep }
    await runInterviewPrep({ llm: llm as never, store }, { analysisId: "a1" })
    expect(savePrep).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "done", attempts: 1, prep: expect.objectContaining({ askThem: ["Ekip?"] }) }))
  })

  it("leaves a done or missing record alone", async () => {
    const savePrep = vi.fn(async () => {})
    await runInterviewPrep({ llm: llm as never, store: { getPrepContext: async () => context("done"), savePrep } }, { analysisId: "a1" })
    await runInterviewPrep({ llm: llm as never, store: { getPrepContext: async () => context(null), savePrep } }, { analysisId: "a1" })
    expect(savePrep).not.toHaveBeenCalled()
  })
})
