import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "@uyarla/core"
import { applyDecision, nextStatus } from "@/server/adaptationDecision"

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
