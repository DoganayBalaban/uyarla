import { describe, expect, it, vi } from "vitest"
import type { InterviewPrepContext, InterviewPrepStore } from "./follow-up-store.js"
import { runInterviewPrep, runPractice } from "./interview-prep-pipeline.js"

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
  /** Kilit altındaki güncellemeyi bellekte taklit ediyor. */
  const memoryStore = (record: ReturnType<typeof context>["record"]) => {
    const state = { record }
    const store: InterviewPrepStore = {
      getPrepContext: async () => ({ ...context(null), record: state.record }),
      updatePrep: vi.fn(async (_id, change) => {
        state.record = change(state.record) ?? state.record
      }),
    }
    return { store, state }
  }

  it("fills a running record and keeps practice entries added meanwhile", async () => {
    const { store, state } = memoryStore({ ...context("running").record!, practice: [{ id: "p1", questionIndex: 0, answer: "x", status: "done", createdAt: "" }] } as never)
    await runInterviewPrep({ llm: llm as never, store }, { analysisId: "a1" })
    expect(state.record).toMatchObject({ status: "done", attempts: 1, prep: { askThem: ["Ekip?"] }, practice: [{ id: "p1" }] })
  })

  it("leaves a done or missing record alone", async () => {
    for (const record of [context("done").record, null]) {
      const { store } = memoryStore(record)
      await runInterviewPrep({ llm: llm as never, store }, { analysisId: "a1" })
      expect(store.updatePrep).not.toHaveBeenCalled()
    }
  })

  it("reviews a running practice answer", async () => {
    const prep = { questions: [{ question: "Performans?", kind: "behavioral", why: "", evidence: [], star: {}, verification: { status: "ok", issues: [] } }], consistency: [], bridges: [], askThem: [] }
    const review = { extract: vi.fn(async () => ({ data: { star: { durum: true, gorev: true, eylem: true, sonuc: false }, guclu: [], gelistir: ["Sonuç?"] }, tokens: 2 })) }
    const { store, state } = memoryStore({
      status: "done",
      createdAt: "",
      attempts: 1,
      prep,
      practice: [{ id: "p1", questionIndex: 0, answer: "Bir cevap", status: "running", createdAt: "" }],
    } as never)
    await runPractice({ llm: review as never, store }, { analysisId: "a1", practiceId: "p1" })
    expect(state.record!.practice![0]).toMatchObject({ status: "done", feedback: { improvements: ["Sonuç?"], star: { result: false } } })
  })
})
