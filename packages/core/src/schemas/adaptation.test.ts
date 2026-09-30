import { describe, it, expect } from "vitest"
import { AdaptationDraftSchema, hasPendingDecisions } from "./adaptation.js"

const cleanBullet = {
  id: "b1",
  experienceIndex: 0,
  original: "React ile panel geliştirdim",
  sourceRef: "React ile panel geliştirdim",
  rewritten: "React kullanarak müşteri panelini geliştirdim",
  verification: { status: "ok" as const, issues: [] },
  decision: "accepted" as const,
}

const draftData = {
  summary: {
    original: "3 yıl React deneyimi",
    rewritten: "React odaklı 3 yıllık frontend deneyimi",
    verification: { status: "ok" as const, issues: [] },
    decision: "accepted" as const,
  },
  bullets: [cleanBullet],
  skillOrder: ["React", "TypeScript"],
}

describe("AdaptationDraftSchema", () => {
  it("accepts a valid draft", () => {
    expect(AdaptationDraftSchema.parse(draftData)).toEqual(draftData)
  })

  it("rejects an undefined decision value", () => {
    expect(() =>
      AdaptationDraftSchema.parse({
        ...draftData,
        bullets: [{ ...cleanBullet, decision: "belki" }],
      }),
    ).toThrow()
  })

  it("rejects an undefined issue kind", () => {
    expect(() =>
      AdaptationDraftSchema.parse({
        ...draftData,
        bullets: [
          {
            ...cleanBullet,
            verification: { status: "flagged", issues: [{ kind: "baska", detail: "x" }] },
          },
        ],
      }),
    ).toThrow()
  })

  it("sourceRef is required", () => {
    const { sourceRef: _discarded, ...missing } = cleanBullet
    expect(() => AdaptationDraftSchema.parse({ ...draftData, bullets: [missing] })).toThrow()
  })
})

describe("hasPendingDecisions", () => {
  it("returns false when no decision is pending", () => {
    expect(hasPendingDecisions(AdaptationDraftSchema.parse(draftData))).toBe(false)
  })

  it("returns true when a decision is pending", () => {
    const pending = AdaptationDraftSchema.parse({
      ...draftData,
      bullets: [
        cleanBullet,
        {
          ...cleanBullet,
          id: "b2",
          verification: {
            status: "flagged",
            issues: [{ kind: "number_mismatch", detail: "%60 kaynakta yok" }],
          },
          decision: "pending",
        },
      ],
    })
    expect(hasPendingDecisions(pending)).toBe(true)
  })

  it("a rejected bullet does not count as pending", () => {
    const rejected = AdaptationDraftSchema.parse({
      ...draftData,
      bullets: [{ ...cleanBullet, decision: "rejected" }],
    })
    expect(hasPendingDecisions(rejected)).toBe(false)
  })
})
