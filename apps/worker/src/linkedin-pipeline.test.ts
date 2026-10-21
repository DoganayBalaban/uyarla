import { describe, expect, it, vi } from "vitest"
import type { LinkedInReportRecord, ResumeProfile } from "@uyarla/core"
import { runLinkedInReport, type LinkedInReportStore } from "./linkedin-pipeline.js"

const profile: ResumeProfile = {
  fullName: "Elif",
  headline: "Frontend Geliştirici",
  summary: null,
  experience: [{ company: "Acme", title: "Frontend Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "React ile panel geliştirdim", sourceRef: "React ile panel geliştirdim" }] }],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}
const posting = {
  position: "Frontend Geliştirici",
  company: "Beta",
  seniority: null,
  language: "tr",
  requirements: [
    { text: "React", type: "skill", importance: "must", concepts: [{ term: "React", synonyms: [] }] },
    { text: "Docker", type: "skill", importance: "must", concepts: [{ term: "Docker", synonyms: [] }] },
  ],
} as never
// Her metne aynı vektör: anlamsal eşleşme sınırı aşılmasın diye dik vektörler.
const embedding = { embed: vi.fn(async (texts: string[]) => texts.map((_, i) => Array.from({ length: 8 }, (__, j) => (j === i % 8 ? 1 : 0)))) }

const storeWith = (record: LinkedInReportRecord | null) => {
  const saved: LinkedInReportRecord[] = []
  const store: LinkedInReportStore = {
    getContext: async () => ({ record, targetRole: null, postings: [{ analysisId: "a1", position: "Frontend Geliştirici", company: "Beta", posting, excluded: [] }] }),
    profile: vi.fn(async () => profile),
    save: async (_id, r) => {
      saved.push(r)
    },
  }
  return { store, saved }
}

describe("runLinkedInReport (DOG-69)", () => {
  it("scores the profile against the chosen postings and writes the report", async () => {
    const { store, saved } = storeWith({ status: "running", analysisIds: ["a1"], createdAt: "" })
    const llm = { extract: vi.fn(async () => ({ data: { baslik: "Frontend Geliştirici | React", hakkinda: "React ile panel geliştirdim." }, tokens: 3 })) }
    await runLinkedInReport({ llm: llm as never, embedding: embedding as never, modelId: "m", store }, { resumeId: "r1" })
    // Adımlar sırayla kayda yazılıyor, sonra rapor (DOG-136).
    expect(saved.map((r) => (r.status === "running" ? r.stage : r.status))).toEqual(["scoring", "writing", "done"])
    const rec = saved.at(-1)!
    expect(rec.status).toBe("done")
    if (rec.status !== "done") throw new Error("beklenmedik")
    expect(rec.report.commonMissing.map((m) => m.term)).toEqual(["Docker"])
    expect(rec.report.postings[0]).toMatchObject({ analysisId: "a1", position: "Frontend Geliştirici" })
    expect(rec.report.suggestions?.headline).toMatchObject({ text: "Frontend Geliştirici | React", verification: { status: "ok" } })
  })

  it("still saves the report when the suggestion fails", async () => {
    const { store, saved } = storeWith({ status: "running", analysisIds: ["a1"], createdAt: "" })
    const llm = { extract: vi.fn(async () => { throw new Error("model düştü") }) }
    await runLinkedInReport({ llm: llm as never, embedding: embedding as never, modelId: "m", store }, { resumeId: "r1" })
    expect(saved.at(-1)).toMatchObject({ status: "done", report: { suggestions: null } })
  })

  it("does not redo a finished report", async () => {
    const { store, saved } = storeWith({ status: "failed", analysisIds: ["a1"], createdAt: "" })
    await runLinkedInReport({ llm: {} as never, embedding: embedding as never, modelId: "m", store }, { resumeId: "r1" })
    expect(saved).toHaveLength(0)
    expect(store.profile).not.toHaveBeenCalled()
  })
})
