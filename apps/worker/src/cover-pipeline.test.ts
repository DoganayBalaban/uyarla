import { describe, expect, it, vi } from "vitest"
import type { JobPostingData, LlmProvider, ResumeProfile } from "@uyarla/core"
import { runCoverLetter } from "./cover-pipeline.js"

const testProfile: ResumeProfile = {
  fullName: "Elif",
  headline: null,
  summary: null,
  experience: [
    {
      company: "Acme",
      title: "Frontend Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [{ text: "React ile panel", sourceRef: "React ile panel geliştirdim" }],
    },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}

const testPosting = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "Kubernetes", type: "skill", importance: "must", concepts: [{ term: "kubernetes", synonyms: [] }] },
  ],
} as unknown as JobPostingData

describe("runCoverLetter", () => {
  it("generates the cover letter and saves it with verification results", async () => {
    const saveCoverLetter = vi.fn(async () => {})
    const llm: LlmProvider = {
      extract: vi.fn(async () => ({
        data: { paragraflar: ["React ile panel geliştirdim.", "Kubernetes biliyorum."] } as never,
        tokens: 30,
      })),
    }

    await runCoverLetter(
      {
        llm,
        store: {
          getAdaptationContext: async () => ({ profile: testProfile, posting: testPosting, result: {} as never }),
          saveCoverLetter,
        },
        now: () => new Date("2026-09-27T10:00:00Z"),
      },
      { adaptationId: "ad-1" },
    )

    expect(saveCoverLetter).toHaveBeenCalledOnce()
    const [id, record] = saveCoverLetter.mock.calls[0] as unknown as [string, any]
    expect(id).toBe("ad-1")
    expect(record.durum).toBe("done")
    expect(record.tokenUsage).toBe(30)
    expect(record.olusturulma).toBe("2026-09-27T10:00:00.000Z")
    expect(record.paragraflar[0].kontrol.status).toBe("ok")
    // CV'de olmayan ilan kavramı işaretleniyor.
    expect(record.paragraflar[1].kontrol.status).toBe("flagged")
  })
})
