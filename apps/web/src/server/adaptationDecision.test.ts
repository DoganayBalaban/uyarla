import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "@uyarla/core/schemas/adaptation"
import {
  adaptationDocument,
  applyBulkDecision,
  applyDecision,
  applyLayout,
  missingMustRequirements,
  nextStatus,
  restoreBullet,
} from "@/server/adaptationDecision"

const draftData: AdaptationDraft = {
  summary: {
    original: "eski",
    rewritten: "yeni",
    verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: "0-0",
      experienceIndex: 0,
      original: "a",
      sourceRef: "a",
      rewritten: "A",
      verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
    {
      id: "0-1",
      experienceIndex: 0,
      original: "b",
      sourceRef: "b",
      rewritten: "B",
      verification: {
        status: "flagged",
        issues: [{ kind: "number_mismatch", detail: "…" }],
      },
      decision: "pending",
    },
  ],
  skillOrder: ["React"],
}

describe("applyDecision", () => {
  it("changes the bullet's decision", () => {
    expect(applyDecision(draftData, "0-1", "accepted").bullets[1]!.decision).toBe("accepted")
  })

  it("leaves other bullets untouched", () => {
    expect(applyDecision(draftData, "0-1", "rejected").bullets[0]!.decision).toBe("accepted")
  })

  it("changes the summary's decision with the summary id", () => {
    expect(applyDecision(draftData, "summary", "rejected").summary.decision).toBe("rejected")
  })

  it("throws for an unknown id", () => {
    // Sessizce yok saymak, kullanıcının tıkladığı kararın kaybolması demek.
    expect(() => applyDecision(draftData, "yok", "accepted")).toThrow(/bulunamadı/i)
  })

  it("does not mutate the input draft", () => {
    applyDecision(draftData, "0-1", "accepted")
    expect(draftData.bullets[1]!.decision).toBe("pending")
  })
})

describe("nextStatus", () => {
  it("draft when a decision is pending", () => {
    expect(nextStatus(draftData)).toBe("draft")
  })

  it("ready when no decision is pending", () => {
    expect(nextStatus(applyDecision(draftData, "0-1", "rejected"))).toBe("ready")
  })
})

describe("applyBulkDecision", () => {
  const withAlignment: AdaptationDraft = {
    ...draftData,
    summary: { ...draftData.summary, decision: "rejected" },
    bullets: [
      ...draftData.bullets,
      {
        id: "0-2",
        experienceIndex: 0,
        original: "sunucu tarafı render",
        sourceRef: "sunucu tarafı render",
        rewritten: "SSR",
        verification: { status: "ok", issues: [] },
        alignments: [{ term: "SSR", basis: "sunucu tarafı render" }],
        decision: "pending",
      },
      {
        id: "0-3",
        experienceIndex: 0,
        original: "aynı",
        sourceRef: "aynı",
        rewritten: "aynı",
        verification: { status: "ok", issues: [] },
        decision: "accepted",
      },
    ],
  }
  const decisions = (d: AdaptationDraft) => d.bullets.map((b) => b.decision)

  it("accepts every verified change, including term alignments waiting for approval", () => {
    const r = applyBulkDecision(withAlignment, "accept_verified")
    expect(r.summary.decision).toBe("accepted")
    expect(decisions(r)).toEqual(["accepted", "pending", "accepted", "accepted"])
  })

  it("never accepts a flagged bullet in bulk", () => {
    const r = applyBulkDecision(withAlignment, "accept_verified")
    expect(r.bullets[1]!.decision).toBe("pending")
    expect(nextStatus(r)).toBe("draft")
  })

  it("rejects everything, flagged ones included, which also unblocks download", () => {
    const r = applyBulkDecision(withAlignment, "reject_all")
    expect(r.summary.decision).toBe("rejected")
    expect(decisions(r)).toEqual(["rejected", "rejected", "rejected", "accepted"])
    expect(nextStatus(r)).toBe("ready")
  })

  it("does not mutate the input draft", () => {
    applyBulkDecision(withAlignment, "reject_all")
    expect(decisions(withAlignment)).toEqual(["accepted", "pending", "pending", "accepted"])
  })
})

describe("contributions (DOG-94)", () => {
  const c = (id: string, over: object = {}) => ({
    id,
    requirementIndex: 0,
    experienceIndex: 0,
    answer: "cevap",
    status: "done" as const,
    text: "madde",
    verification: { status: "ok" as const, issues: [] },
    decision: "pending" as const,
    ...over,
  })
  const withContributions: AdaptationDraft = {
    ...draftData,
    contributions: [c("k1"), c("k2", { verification: { status: "flagged", issues: [{ kind: "number_mismatch", detail: "…" }] } }), c("k3", { status: "running", text: undefined })],
  }

  it("decides a written contribution by its id", () => {
    expect(applyDecision(withContributions, "k1", "accepted").contributions![0]!.decision).toBe("accepted")
  })

  it("refuses a decision on a contribution that is still being written", () => {
    expect(() => applyDecision(withContributions, "k3", "accepted")).toThrow(/bulunamadı/i)
  })

  it("bulk-accepts verified contributions but never a flagged or unfinished one", () => {
    const r = applyBulkDecision(withContributions, "accept_verified")
    expect(r.contributions!.map((x) => x.decision)).toEqual(["accepted", "pending", "pending"])
    expect(applyBulkDecision(withContributions, "reject_all").contributions!.map((x) => x.decision)).toEqual([
      "rejected",
      "rejected",
      "pending",
    ])
  })
})

describe("missingMustRequirements", () => {
  const req = (text: string, importance: string, status: string) => ({ requirement: { text, importance }, status })

  it("lists missing must requirements with their index, leaving out ones marked as not in the posting", () => {
    const result = {
      requirements: [req("Excel", "must", "matched"), req("SAP", "must", "missing"), req("Almanca", "nice", "missing"), req("İş hukuku", "must", "missing")],
      excluded: [3],
    }
    expect(missingMustRequirements(result)).toEqual([{ index: 1, text: "SAP" }])
  })

  it("leaves out soft requirements once they no longer count toward the score (DOG-103)", () => {
    const soft = { requirement: { text: "Takım çalışması", importance: "must", type: "soft" }, status: "missing" }
    const requirements = [req("SAP", "must", "missing"), soft]
    expect(missingMustRequirements({ requirements, scoringRevision: 2 })).toEqual([{ index: 0, text: "SAP" }])
    // Eski analizde soft da eksik sayılıyordu; ekran onunla tutarlı kalıyor.
    expect(missingMustRequirements({ requirements })).toHaveLength(2)
  })

  it("is empty for a missing or malformed result", () => {
    expect(missingMustRequirements(null)).toEqual([])
    expect(missingMustRequirements({})).toEqual([])
  })
})

describe("one-page layout (DOG-93)", () => {
  const omittedDraft: AdaptationDraft = { ...draftData, layout: "onePage", omitted: ["0-0", "0-1"] }

  it("restores one omitted bullet and leaves the others", () => {
    expect(restoreBullet(omittedDraft, "0-0").omitted).toEqual(["0-1"])
    expect(() => restoreBullet(omittedDraft, "9-9")).toThrow()
  })

  it("going back to the full layout brings every omitted bullet back", async () => {
    const { draft, onePage } = await applyLayout(
      { profile: null as never, posting: null as never, draft: omittedDraft, ownerId: "u" },
      "full",
    )
    expect(draft).toMatchObject({ layout: "full", omitted: [] })
    expect(onePage).toBeNull()
  })

  it("the document view keeps omitted bullets so positions still pair", () => {
    const profile = {
      fullName: null, headline: null, summary: "eski", education: [], skills: [], languages: [], certifications: [],
      experience: [{ company: "A", title: "T", startDate: "", endDate: "", bullets: [{ text: "a", sourceRef: "a" }, { text: "b", sourceRef: "b" }] }],
    }
    expect(adaptationDocument(profile, omittedDraft)!.after.experience[0]!.bullets).toEqual(["A", "b"])
  })
})
