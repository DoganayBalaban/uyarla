import { describe, expect, it, vi } from "vitest"
import type { FollowUpContext, FollowUpStore } from "./follow-up-store.js"
import { runFollowUp } from "./follow-up-pipeline.js"

const context = (status: "running" | "done"): FollowUpContext => ({
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
  record: { id: "f1", kind: "followup", channel: "email", status, createdAt: "2026-10-20T10:00:00Z" },
  date: "2026-10-10",
})

const llm = { extract: vi.fn(async () => ({ data: { konu: "Başvurum", metin: "Merhaba, Acme'de React ile panel geliştirdim. Elif" }, tokens: 5 })) }

describe("runFollowUp (DOG-117)", () => {
  it("writes the draft back as done", async () => {
    const update = vi.fn(async () => {})
    const store: FollowUpStore = { getContext: async () => context("running"), update }
    await runFollowUp({ llm: llm as never, store }, { analysisId: "a1", followUpId: "f1" })
    expect(update).toHaveBeenCalledWith("a1", "f1", expect.objectContaining({ status: "done", subject: "Başvurum", verification: { status: "ok", issues: [] } }))
  })

  it("does not rewrite a draft that is already done", async () => {
    const update = vi.fn(async () => {})
    await runFollowUp({ llm: llm as never, store: { getContext: async () => context("done"), update } }, { analysisId: "a1", followUpId: "f1" })
    expect(update).not.toHaveBeenCalled()
  })
})
