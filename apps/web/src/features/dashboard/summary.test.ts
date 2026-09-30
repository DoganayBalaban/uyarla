import { describe, expect, it } from "vitest"
import { summarize as summarize } from "./summary"
import type { BoardCard } from "@/features/applications/board"

function card(suffix: Partial<BoardCard> = {}): BoardCard {
  return {
    analysisId: "a1",
    position: "Frontend Geliştirici",
    score: 47,
    stage: "saved",
    stageChangedAt: null,
    noteText: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    adaptation: null,
    ...suffix,
  }
}

describe("dashboard summary", () => {
  it("counts every stage, an empty stage is zero", () => {
    const o = summarize([card(), card({ stage: "applied" }), card({ stage: "applied" })])
    expect(o.stageCounts).toEqual({ saved: 1, applied: 2, interview: 0, offer: 0, rejected: 0 })
    expect(o.total).toBe(3)
  })

  it("pending: an adaptation awaiting decisions first, then a ready resume, then an unadapted analysis", () => {
    const o = summarize([
      card({ analysisId: "not-adapted", createdAt: "2026-09-25T00:00:00Z" }),
      card({ analysisId: "ready", adaptation: { id: "u2", status: "ready" } }),
      card({ analysisId: "decide", adaptation: { id: "u1", status: "draft" } }),
    ])
    expect(o.pending.map((b) => [b.kind, b.analysisId])).toEqual([
      ["decide", "decide"],
      ["ready", "ready"],
      ["adapt", "not-adapted"],
    ])
    expect(o.pending[0]?.address).toBe("/adapt/u1")
    expect(o.pending[2]?.address).toBe("/analyze?analiz=not-adapted")
  })

  it("an applied or concluded posting is not pending", () => {
    const o = summarize([
      card({ stage: "applied", adaptation: { id: "u1", status: "ready" } }),
      card({ stage: "rejected" }),
      // Karar bekleyen madde aşamadan bağımsız: indirme kapalı kalıyor.
      card({ analysisId: "k", stage: "interview", adaptation: { id: "u3", status: "draft" } }),
    ])
    expect(o.pending.map((b) => b.analysisId)).toEqual(["k"])
  })

  it("a running or failed adaptation is not pending", () => {
    const o = summarize([
      card({ adaptation: { id: "u1", status: "running" } }),
      card({ adaptation: { id: "u2", status: "failed" } }),
    ])
    expect(o.pending).toEqual([])
  })

  it("recent analyses newest first, at most five", () => {
    const cards = Array.from({ length: 7 }, (_, i) =>
      card({ analysisId: `a${i}`, createdAt: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00Z` }),
    )
    expect(summarize(cards).recentAnalyses.map((k) => k.analysisId)).toEqual(["a6", "a5", "a4", "a3", "a2"])
  })
})
