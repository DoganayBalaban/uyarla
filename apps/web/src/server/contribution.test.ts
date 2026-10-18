import { describe, expect, it } from "vitest"
import type { AdaptationDraft } from "@uyarla/core/schemas/adaptation"
import type { JobPostingData } from "@uyarla/core/schemas/job"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { MAX_CONTRIBUTIONS, addContribution } from "@/server/contribution"

const draft: AdaptationDraft = {
  summary: { original: null, rewritten: "", verification: { status: "ok", issues: [] }, decision: "accepted" },
  bullets: [],
  skillOrder: [],
}
const profile = { experience: [{ company: "Acme", title: "Uzman", startDate: "", endDate: "", bullets: [] }] } as unknown as ResumeProfile
const posting = { requirements: [{ text: "Docker", type: "skill", importance: "must", concepts: [] }] } as unknown as JobPostingData
const answer = "staj projesinde docker compose ile 3 servisi ayağa kaldırdım"

describe("addContribution", () => {
  it("appends a running contribution with the trimmed answer", () => {
    const r = addContribution(draft, profile, posting, { requirementIndex: 0, experienceIndex: 0, answer: `  ${answer}  ` }, "c1")
    expect("error" in r).toBe(false)
    if ("error" in r) return
    expect(r.contribution).toEqual({ id: "c1", requirementIndex: 0, experienceIndex: 0, answer, status: "running", decision: "pending" })
    expect(r.draft.contributions).toHaveLength(1)
  })

  it("rejects unknown requirement or experience indexes", () => {
    expect(addContribution(draft, profile, posting, { requirementIndex: 3, experienceIndex: 0, answer }, "c")).toEqual({ error: "invalid_requirement" })
    expect(addContribution(draft, profile, posting, { requirementIndex: 0, experienceIndex: 1, answer }, "c")).toEqual({ error: "invalid_experience" })
    expect(addContribution(draft, profile, posting, { requirementIndex: "0", experienceIndex: 0, answer }, "c")).toEqual({ error: "invalid_requirement" })
  })

  it("asks for a longer answer and caps a long one", () => {
    expect(addContribution(draft, profile, posting, { requirementIndex: 0, experienceIndex: 0, answer: "docker biliyorum" }, "c")).toEqual({ error: "answer_too_short" })
    expect(addContribution(draft, profile, posting, { requirementIndex: 0, experienceIndex: 0, answer: "x".repeat(601) }, "c")).toEqual({ error: "answer_too_long" })
  })

  it("refuses a second request while one is running for the same requirement, and caps the total", () => {
    const first = addContribution(draft, profile, posting, { requirementIndex: 0, experienceIndex: 0, answer }, "c1")
    if ("error" in first) throw new Error("beklenmedik")
    expect(addContribution(first.draft, profile, posting, { requirementIndex: 0, experienceIndex: 0, answer }, "c2")).toEqual({ error: "already_running" })

    const full = { ...draft, contributions: Array.from({ length: MAX_CONTRIBUTIONS }, (_, i) => ({ ...first.contribution, id: `x${i}`, status: "done" as const })) }
    expect(addContribution(full, profile, posting, { requirementIndex: 0, experienceIndex: 0, answer }, "c3")).toEqual({ error: "too_many" })
  })
})
