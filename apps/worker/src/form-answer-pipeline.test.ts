import { describe, expect, it, vi } from "vitest"
import type { FormAnswerContext, FormAnswerStore } from "./follow-up-store.js"
import { runFormAnswer } from "./form-answer-pipeline.js"

const context = (status: "running" | "done"): FormAnswerContext => ({
  profile: {
    fullName: "Elif",
    headline: null,
    summary: null,
    experience: [{ company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "React ile panel geliştirdim", sourceRef: "React ile panel geliştirdim" }] }],
    education: [],
    skills: ["React"],
    languages: [],
    certifications: [],
  },
  coverLetter: [],
  posting: { position: "Geliştirici", company: "Beta", seniority: null, language: "tr", requirements: [] },
  record: { id: "q1", question: "Neden sen?", limit: { unit: "chars", max: 140 }, status, createdAt: "2026-10-20T10:00:00Z" },
})

const llm = { extract: vi.fn(async () => ({ data: { yanit: "Acme'de React ile panel geliştirdim." }, tokens: 5 })) }

describe("runFormAnswer (DOG-123)", () => {
  it("writes the answer back as done", async () => {
    const update = vi.fn(async () => {})
    const store: FormAnswerStore = { getContext: async () => context("running"), update }
    await runFormAnswer({ llm: llm as never, store }, { analysisId: "a1", answerId: "q1" })
    expect(update).toHaveBeenCalledWith("a1", "q1", expect.objectContaining({ status: "done", text: "Acme'de React ile panel geliştirdim.", verification: { status: "ok", issues: [] } }))
  })

  it("does not rewrite an answer that is already done", async () => {
    const update = vi.fn(async () => {})
    await runFormAnswer({ llm: llm as never, store: { getContext: async () => context("done"), update } }, { analysisId: "a1", answerId: "q1" })
    expect(update).not.toHaveBeenCalled()
  })
})
