import { describe, expect, it, vi } from "vitest"
import type { AdaptationDraft, Contribution, JobPostingData, LlmProvider, ResumeProfile } from "@uyarla/core"
import { runContribution } from "./contribution-pipeline.js"

const profile: ResumeProfile = {
  fullName: null,
  headline: null,
  summary: null,
  experience: [{ company: "Acme", title: "Uzman", startDate: "2022", endDate: "halen", bullets: [] }],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
}

const posting: JobPostingData = {
  position: "Uzman",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [{ text: "Docker deneyimi", type: "skill", importance: "must", concepts: [{ term: "Docker", synonyms: [] }] }],
}

const running: Contribution = {
  id: "c1",
  requirementIndex: 0,
  experienceIndex: 0,
  answer: "staj projesinde docker compose ile 3 servisi ayağa kaldırdım",
  status: "running",
  decision: "pending",
}

function deps(contribution: Contribution | undefined, rewritten = "Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.") {
  const draft: AdaptationDraft = {
    summary: { original: null, rewritten: "", verification: { status: "ok", issues: [] }, decision: "accepted" },
    bullets: [],
    skillOrder: [],
    contributions: contribution ? [contribution] : [],
  }
  const llm: LlmProvider = { extract: vi.fn(async () => ({ data: { rewritten, alignments: [] } as never, tokens: 7 })) }
  const updateContribution = vi.fn(async () => {})
  return {
    llm,
    embedding: { embed: vi.fn(async (t: string[]) => t.map(() => [1, 0])) },
    store: {
      getAdaptationContext: vi.fn(async () => ({ profile, posting, result: {} as never })),
      getDraft: vi.fn(async () => draft),
      updateContribution,
    },
    updateContribution,
  }
}

describe("runContribution", () => {
  it("writes the bullet from the user's answer and saves it as done", async () => {
    const d = deps(running)
    await runContribution(d, { adaptationId: "a1", contributionId: "c1" })
    expect(d.updateContribution).toHaveBeenCalledWith("a1", "c1", {
      status: "done",
      text: "Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.",
      alignments: [],
      verification: { status: "ok", issues: [] },
      decision: "accepted",
    })
  })

  it("does nothing for a contribution that is already finished (retried job)", async () => {
    const d = deps({ ...running, status: "done" })
    await runContribution(d, { adaptationId: "a1", contributionId: "c1" })
    expect(d.updateContribution).not.toHaveBeenCalled()
    expect(d.llm.extract).not.toHaveBeenCalled()
  })

  it("marks the contribution failed when its requirement no longer exists", async () => {
    const d = deps({ ...running, requirementIndex: 5 })
    await runContribution(d, { adaptationId: "a1", contributionId: "c1" })
    expect(d.updateContribution).toHaveBeenCalledWith("a1", "c1", { status: "failed" })
  })

  it("saves an empty bullet as done when the answer is not an experience", async () => {
    const d = deps({ ...running, answer: "bilmiyorum ama öğrenebilirim" }, "")
    await runContribution(d, { adaptationId: "a1", contributionId: "c1" })
    expect(d.updateContribution).toHaveBeenCalledWith("a1", "c1", expect.objectContaining({ status: "done", text: "" }))
  })
})
