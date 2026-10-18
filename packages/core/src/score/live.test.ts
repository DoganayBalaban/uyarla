import { describe, expect, it } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { correctPosting } from "./exclusions.js"
import { scoreProfile } from "./live.js"

const PROFILE = {
  fullName: "Elif", headline: null, summary: null,
  experience: [
    { company: "Acme", title: "Test Uzmanı", startDate: "Sep 2025", endDate: "Present", bullets: [{ text: "Yazılım test süreçleri", sourceRef: "x" }] },
  ],
  education: [], skills: [], languages: [], certifications: [],
} as unknown as ResumeProfile

const POSTING: JobPostingData = {
  position: "Test Uzmanı", company: null, seniority: null, language: "tr",
  requirements: [
    { text: "En az 3 yıl yazılım test deneyimi", type: "experience", importance: "must", concepts: [{ term: "yazılım test", synonyms: [] }] },
  ],
}

const embedding = { embed: async (texts: string[]) => texts.map(() => [1, 0]) }
const NOW = new Date("2026-10-15T12:00:00Z")

describe("scoreProfile (DOG-90)", () => {
  it("scores a profile against a posting with one embedding call", async () => {
    let calls = 0
    const counted = { embed: async (t: string[]) => (calls++, embedding.embed(t)) }
    const result = await scoreProfile({ profile: PROFILE, posting: POSTING, now: NOW }, counted)
    expect(calls).toBe(1)
    // ~1 yıl var, ilan 3 yıl istiyor.
    expect(result.requirements[0]!.status).toBe("missing")
  })

  it("follows a corrected posting", async () => {
    const fixed = correctPosting(POSTING, { 0: { minYears: 1 } })
    const result = await scoreProfile({ profile: PROFILE, posting: fixed, now: NOW }, embedding)
    expect(result.requirements[0]!.status).toBe("matched")
  })
})
