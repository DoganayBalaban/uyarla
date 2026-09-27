import { describe, expect, it, vi } from "vitest"
import type { JobPostingData, LlmProvider, ResumeProfile } from "@uyarla/core"
import { runCoverLetter } from "./cover-pipeline.js"

const profil: ResumeProfile = {
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

const ilan = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "Kubernetes", type: "skill", importance: "must", concepts: [{ term: "kubernetes", synonyms: [] }] },
  ],
} as unknown as JobPostingData

describe("runCoverLetter", () => {
  it("ön yazıyı üretip kontrol sonuçlarıyla kaydediyor", async () => {
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
          getAdaptationContext: async () => ({ profile: profil, posting: ilan, result: {} as never }),
          saveCoverLetter,
        },
        now: () => new Date("2026-09-27T10:00:00Z"),
      },
      { adaptationId: "ad-1" },
    )

    expect(saveCoverLetter).toHaveBeenCalledOnce()
    const [id, kayit] = saveCoverLetter.mock.calls[0] as unknown as [string, any]
    expect(id).toBe("ad-1")
    expect(kayit.durum).toBe("done")
    expect(kayit.tokenUsage).toBe(30)
    expect(kayit.olusturulma).toBe("2026-09-27T10:00:00.000Z")
    expect(kayit.paragraflar[0].kontrol.status).toBe("ok")
    // CV'de olmayan ilan kavramı işaretleniyor.
    expect(kayit.paragraflar[1].kontrol.status).toBe("flagged")
  })
})
