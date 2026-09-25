import { describe, it, expect } from "vitest"
import { AdaptationDraftSchema, hasPendingDecisions } from "./adaptation.js"

const temizMadde = {
  id: "b1",
  experienceIndex: 0,
  original: "React ile panel geliştirdim",
  sourceRef: "React ile panel geliştirdim",
  rewritten: "React kullanarak müşteri panelini geliştirdim",
  verification: { status: "ok" as const, issues: [] },
  decision: "accepted" as const,
}

const taslak = {
  summary: {
    original: "3 yıl React deneyimi",
    rewritten: "React odaklı 3 yıllık frontend deneyimi",
    verification: { status: "ok" as const, issues: [] },
    decision: "accepted" as const,
  },
  bullets: [temizMadde],
  skillOrder: ["React", "TypeScript"],
}

describe("AdaptationDraftSchema", () => {
  it("geçerli bir taslağı kabul eder", () => {
    expect(AdaptationDraftSchema.parse(taslak)).toEqual(taslak)
  })

  it("tanımsız karar değerini reddeder", () => {
    expect(() =>
      AdaptationDraftSchema.parse({
        ...taslak,
        bullets: [{ ...temizMadde, decision: "belki" }],
      }),
    ).toThrow()
  })

  it("tanımsız uyarı türünü reddeder", () => {
    expect(() =>
      AdaptationDraftSchema.parse({
        ...taslak,
        bullets: [
          {
            ...temizMadde,
            verification: { status: "flagged", issues: [{ kind: "baska", detail: "x" }] },
          },
        ],
      }),
    ).toThrow()
  })

  it("sourceRef zorunludur", () => {
    const { sourceRef: _atilan, ...eksik } = temizMadde
    expect(() => AdaptationDraftSchema.parse({ ...taslak, bullets: [eksik] })).toThrow()
  })
})

describe("hasPendingDecisions", () => {
  it("bekleyen karar yoksa false döner", () => {
    expect(hasPendingDecisions(AdaptationDraftSchema.parse(taslak))).toBe(false)
  })

  it("bekleyen karar varsa true döner", () => {
    const bekleyen = AdaptationDraftSchema.parse({
      ...taslak,
      bullets: [
        temizMadde,
        {
          ...temizMadde,
          id: "b2",
          verification: {
            status: "flagged",
            issues: [{ kind: "number_mismatch", detail: "%60 kaynakta yok" }],
          },
          decision: "pending",
        },
      ],
    })
    expect(hasPendingDecisions(bekleyen)).toBe(true)
  })

  it("reddedilmiş madde bekleyen sayılmaz", () => {
    const reddedilmis = AdaptationDraftSchema.parse({
      ...taslak,
      bullets: [{ ...temizMadde, decision: "rejected" }],
    })
    expect(hasPendingDecisions(reddedilmis)).toBe(false)
  })
})
