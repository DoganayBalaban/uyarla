import { describe, expect, it } from "vitest"
import { GUIDE_QUESTIONS, recommendStart, type GuideAnswers } from "@/features/guide/recommend"

const base: GuideAnswers = { stage: "preparing", hasPosting: true, resume: "ready", linkedin: "active" }

describe("recommendStart (DOG-101)", () => {
  it("sends someone with a posting and a CV straight to the analysis", () => {
    const { primary, next } = recommendStart(base)
    expect(primary.id).toBe("analyze")
    expect(primary.registered).toBe(false)
    expect(next.map((s) => s.id)).not.toContain("analyze")
  })

  it("without a CV, shows the sample report first and says uyarla does not write one from scratch", () => {
    const { primary, next, note } = recommendStart({ ...base, resume: "none", hasPosting: false })
    expect(primary.id).toBe("sample_report")
    expect(primary.why).toContain("sıfırdan CV yazmıyor")
    expect(next[0]?.id).toBe("sample_posting")
    expect(note).toContain("CV hazırla")
  })

  it("for interviews, analyses the posting first instead of an empty interviews page", () => {
    const { primary, next } = recommendStart({ ...base, stage: "interviewing", hasPosting: false })
    expect(primary.id).toBe("analyze")
    expect(primary.title).toBe("Çağrıldığın ilanı analiz et")
    expect(next[0]?.id).toBe("interviews")
  })

  it("without a posting, finds postings; a passive searcher with a neglected profile starts on LinkedIn", () => {
    expect(recommendStart({ ...base, hasPosting: false }).primary.id).toBe("jobs")
    expect(recommendStart({ ...base, hasPosting: false, stage: "passive", linkedin: "weak" }).primary.id).toBe("linkedin")
    expect(recommendStart({ ...base, hasPosting: false, stage: "passive", linkedin: "none" }).primary.id).toBe("jobs")
  })

  it("never suggests the LinkedIn report to someone without a profile", () => {
    for (const stage of ["preparing", "no_response", "interviewing", "passive"] as const) {
      for (const hasPosting of [true, false]) {
        const r = recommendStart({ ...base, stage, hasPosting, linkedin: "none" })
        expect([r.primary, ...r.next].map((s) => s.id)).not.toContain("linkedin")
      }
    }
  })

  it("every answer combination gives a primary step, at most two distinct next steps and no numbers", () => {
    for (const stage of GUIDE_QUESTIONS[0].options.map((o) => o.value)) {
      for (const hasPosting of GUIDE_QUESTIONS[1].options.map((o) => o.value)) {
        for (const resume of GUIDE_QUESTIONS[2].options.map((o) => o.value)) {
          for (const linkedin of GUIDE_QUESTIONS[3].options.map((o) => o.value)) {
            const r = recommendStart({ stage, hasPosting, resume, linkedin })
            const ids = [r.primary, ...r.next].map((s) => s.id)
            expect(new Set(ids).size).toBe(ids.length)
            expect(r.next.length).toBeLessThanOrEqual(2)
            // Ölçülmemiş oran yok (rehber §11).
            for (const text of [r.primary.why, ...r.next.map((s) => s.why), r.note ?? ""]) {
              expect(text).not.toMatch(/%|\d/)
            }
          }
        }
      }
    }
  })

  it("mentions the no-response reason only when it applies", () => {
    expect(recommendStart({ ...base, stage: "no_response" }).note).toContain("Dönüş gelmiyorsa")
    expect(recommendStart(base).note).toBeNull()
  })
})
