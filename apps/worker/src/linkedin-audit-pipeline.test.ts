import { describe, expect, it, vi } from "vitest"
import type { LinkedInProfileData, LinkedInRewrites, ResumeProfile } from "@uyarla/core"
import { runLinkedInAudit, type LinkedInAuditContext, type LinkedInAuditStore } from "./linkedin-audit-pipeline.js"

const profile: LinkedInProfileData = {
  name: "Deniz Aksoy",
  headline: "Pazarlama",
  about: null,
  experience: [{ title: "Uzman", company: "Acme", dateRange: "2022 - Present", location: null, description: "• Meta kampanyalarını yönettim." }],
  education: [],
  certifications: [],
  skills: ["Google Ads"],
  languages: [],
  truncated: {},
}
const llm = {
  extract: vi
    .fn()
    .mockResolvedValueOnce({ data: { basliklar: ["Uzman | Google Ads"], hakkinda: "Meta kampanyalarını yönetiyorum." }, tokens: 5 })
    .mockResolvedValueOnce({ data: { aciklamalar: [{ sira: 1, metin: "• Meta kampanyalarını yönettim." }] }, tokens: 5 }),
}
const embedding = { embed: vi.fn(async (texts: string[]) => texts.map(() => [1, 0])) }

function storeWith(audit: Partial<LinkedInAuditContext["audit"]>) {
  const updates: Array<Record<string, unknown>> = []
  const store: LinkedInAuditStore = {
    getContext: async () => ({
      audit: { id: "au1", status: "running", source: "extension", resumeId: null, profile, targetRole: null, analysisIds: [], report: null, rewrites: null, ...audit },
      goal: null,
      postings: [],
    }),
    resumeProfile: vi.fn(async () => ({ fullName: "Deniz", headline: null, summary: null, experience: [], education: [], skills: [], languages: [], certifications: [] }) as ResumeProfile),
    update: async (_id, data) => {
      updates.push(data)
    },
  }
  return { store, updates }
}

describe("runLinkedInAudit", () => {
  it("reads, checks, writes and saves the result in order", async () => {
    const { store, updates } = storeWith({})
    await runLinkedInAudit({ llm: llm as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    expect(updates.map((u) => u.stage ?? u.status)).toEqual(["reading", "checking", "writing", "done"])
    expect(updates[2]!.report).toBeTruthy()
    expect((updates[3]!.rewrites as LinkedInRewrites).headline.status).toBe("done")
  })

  it("turns the PDF's parsed profile into profile data first", async () => {
    const { store, updates } = storeWith({ source: "pdf", resumeId: "r1", profile: null })
    await runLinkedInAudit({ llm: { extract: vi.fn(async () => ({ data: { basliklar: [], hakkinda: "" }, tokens: 0 })) } as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    expect(store.resumeProfile).toHaveBeenCalled()
    expect((updates.find((u) => "profile" in u)!.profile as LinkedInProfileData).name).toBe("Deniz")
  })

  it("does nothing for an audit that is no longer running", async () => {
    const { store, updates } = storeWith({ status: "done" })
    await runLinkedInAudit({ llm: llm as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    expect(updates).toEqual([])
  })

  it("on retry rewrites only failed parts and keeps the report", async () => {
    const failed: LinkedInRewrites = { headline: { status: "done", options: [{ text: "Eski", verification: { status: "ok", issues: [] } }] }, about: { status: "failed" }, experience: [] }
    const { store, updates } = storeWith({ status: "running", report: { sections: [], summary: { passed: 0, total: 0 }, skills: { add: [], pinFirst: [] }, skipped: [], postings: [], commonMissing: [] }, rewrites: failed })
    const retryLlm = { extract: vi.fn(async () => ({ data: { basliklar: ["Yeni"], hakkinda: "Meta kampanyalarını yönetiyorum." }, tokens: 1 })) }
    await runLinkedInAudit({ llm: retryLlm as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1", retry: true })
    const saved = updates.at(-1)!
    expect(saved.status).toBe("done")
    const rewrites = saved.rewrites as LinkedInRewrites
    expect(rewrites.headline.status === "done" && rewrites.headline.options[0]!.text).toBe("Eski")
    expect(rewrites.about.status).toBe("done")
    expect(updates.some((u) => "report" in u)).toBe(false)
  })

  it("gives the headline writer the profile's own skills when there is no posting (son inceleme)", async () => {
    const { store } = storeWith({})
    const writer = { extract: vi.fn(async () => ({ data: { basliklar: [], hakkinda: "", aciklamalar: [] }, tokens: 0 })) }
    await runLinkedInAudit({ llm: writer as never, embedding: embedding as never, modelId: "m", store }, { auditId: "au1" })
    const firstInput = (writer.extract.mock.calls[0] as unknown as [{ input: string }])[0].input
    expect(firstInput).toContain("BECERİLER: Google Ads")
  })
})
