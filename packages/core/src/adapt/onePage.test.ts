import { describe, it, expect, vi } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { planOnePage } from "./onePage.js"
import { applyAdaptation, bulletId } from "./profile.js"

/** "React" geçen metinler bir yönde, diğerleri öbür yönde. */
const embedding = {
  embed: vi.fn(async (t: string[]) => t.map((m) => (/react/i.test(m) ? [1, 0] : [0, 1]))),
}

const posting: JobPostingData = {
  position: "",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [{ text: "React deneyimi", type: "skill", importance: "must", concepts: [{ term: "React", synonyms: [] }] }],
}

const job = (company: string, lines: string[]) => ({
  company,
  title: "Geliştirici",
  startDate: "2020",
  endDate: "2022",
  bullets: lines.map((text) => ({ text, sourceRef: text })),
})

const filler = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => `${tag} ${i}: rapor hazırladım ve toplantılara katıldım, süreçleri belgeledim`)

function profileOf(experience: ResumeProfile["experience"]): ResumeProfile {
  return { fullName: "Ad", headline: null, summary: null, experience, education: [], skills: [], languages: [], certifications: [] }
}

function draftOf(profile: ResumeProfile): AdaptationDraft {
  return {
    summary: { original: null, rewritten: "", verification: { status: "ok", issues: [] }, decision: "rejected" },
    bullets: profile.experience.flatMap((j, i) =>
      j.bullets.map((b, k) => ({
        id: bulletId(i, k),
        original: b.text,
        sourceRef: b.sourceRef,
        rewritten: b.text,
        verification: { status: "ok" as const, issues: [] },
        decision: "rejected" as const,
      })),
    ),
    skillOrder: [],
  }
}

describe("planOnePage (DOG-93)", () => {
  it("does nothing when the compact layout already fits one page", async () => {
    const profile = profileOf([job("Acme", ["React ile panel geliştirdim", "Test yazdım"])])
    const plan = await planOnePage({ profile, posting, draft: draftOf(profile) }, embedding)
    expect(plan).toMatchObject({ fits: true, pagesBefore: 1, omitted: [] })
  })

  it("drops the least relevant bullets until one page, keeping evidence and the score", async () => {
    const profile = profileOf([
      job("Acme", ["React ile panel geliştirdim", ...filler(30, "Acme")]),
      job("Beta", filler(30, "Beta")),
    ])
    const draft = draftOf(profile)
    const plan = await planOnePage({ profile, posting, draft }, embedding)

    expect(plan.pagesBefore).toBeGreaterThan(1)
    expect(plan.fits).toBe(true)
    expect(plan.pages).toBe(1)
    // Gereksinimin kanıtı olan madde kalıyor; skor düşmüyor.
    expect(plan.omitted).not.toContain(bulletId(0, 0))
    expect(plan.scoreAfter).toBe(plan.scoreBefore)
    expect(plan.scoreBefore).toBe(100)
    // Hiçbir iş maddesiz kalmıyor.
    const adapted = applyAdaptation(profile, { ...draft, omitted: plan.omitted })
    for (const j of adapted.experience) expect(j.bullets.length).toBeGreaterThan(0)
  })
})
