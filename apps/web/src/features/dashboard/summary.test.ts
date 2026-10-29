import { describe, expect, it } from "vitest"
import { bucketTimeline, summarize } from "@/features/dashboard/summary"
import type { BoardCard } from "@/features/applications/board"

function card(suffix: Partial<BoardCard> = {}): BoardCard {
  return {
    analysisId: "a1",
    position: "Frontend Geliştirici",
    company: null,
    score: 47,
    stage: "saved",
    stageChangedAt: null,
    noteText: null,
    interviewAt: null,
    deadline: null,
    followUps: [],
    createdAt: "2026-09-20T10:00:00.000Z",
    adaptation: null,
    readiness: null,
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

describe("dashboard summary · DOG-145", () => {
  const now = new Date("2026-10-20T09:00:00Z")

  it("puts an interview within a week first and a near deadline before ready resumes", () => {
    const o = summarize(
      [
        card({ analysisId: "ready", adaptation: { id: "u2", status: "ready" } }),
        card({ analysisId: "deadline", deadline: "2026-10-24" }),
        card({ analysisId: "late", deadline: "2026-11-30" }),
        card({ analysisId: "interview", stage: "interview", interviewAt: "2026-10-22" }),
        card({ analysisId: "past", stage: "interview", interviewAt: "2026-10-01" }),
      ],
      now,
    )
    expect(o.pending.map((b) => [b.kind, b.analysisId])).toEqual([
      ["interview", "interview"],
      ["deadline", "deadline"],
      ["ready", "ready"],
      ["adapt", "late"],
    ])
    expect(o.pending[0]).toMatchObject({ address: "/applications/interview/interview", date: "2026-10-22" })
  })

  it("counts metrics from the user's own cards", () => {
    const o = summarize(
      [
        card({ score: 80, createdAt: "2026-10-19T10:00:00Z" }),
        card({ score: 40, stage: "applied", createdAt: "2026-10-01T10:00:00Z" }),
        card({ score: null, stage: "interview", createdAt: "2026-08-01T10:00:00Z" }),
        card({ score: 61, stage: "offer", createdAt: "2026-08-02T10:00:00Z" }),
      ],
      now,
    )
    expect(o.metrics).toEqual({ analysesLast30: 2, applied: 3, positive: 2, averageScore: 60, averageRevision: 3 })
  })

  it("averages only the scores of the newest formula (DOG-165)", () => {
    // Eski formülün skoru yeni ölçekle karışmasın: 80 (sürüm 3) ve 30 (sürüm 2).
    const o = summarize([card({ score: 80, scoringRevision: 3 }), card({ score: 30, scoringRevision: 2 })], now)
    expect(o.metrics.averageScore).toBe(80)
    expect(o.metrics.averageRevision).toBe(3)
    const old = summarize([card({ score: 30, scoringRevision: 2 }), card({ score: 40, scoringRevision: 1 })], now)
    expect(old.metrics.averageScore).toBe(30)
    expect(old.metrics.averageRevision).toBe(2)
  })

  it("builds a daily timeline in Istanbul time, empty days included", () => {
    const o = summarize(
      [
        // 21:30 UTC İstanbul'da ertesi gün.
        card({ score: 50, createdAt: "2026-10-18T21:30:00Z" }),
        card({ score: 70, createdAt: "2026-10-19T08:00:00Z" }),
        card({ score: null, createdAt: "2026-10-17T08:00:00Z" }),
      ],
      now,
    )
    expect(o.timeline).toHaveLength(90)
    expect(o.timeline.at(-1)).toEqual({ date: "2026-10-20", analyses: 0, score: null })
    expect(o.timeline.at(-2)).toEqual({ date: "2026-10-19", analyses: 2, score: 60 })
    expect(o.timeline.at(-4)).toEqual({ date: "2026-10-17", analyses: 1, score: null })
  })
})

describe("bucketTimeline", () => {
  it("sums weeks from the newest day and weights the score by analyses", () => {
    const days = Array.from({ length: 9 }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, "0")}`, analyses: 0, score: null as number | null }))
    days[8] = { ...days[8]!, analyses: 3, score: 40 }
    days[7] = { ...days[7]!, analyses: 1, score: 80 }
    days[0] = { ...days[0]!, analyses: 2, score: null }
    expect(bucketTimeline(days, 7)).toEqual([
      { date: "2026-10-10", analyses: 2, score: null },
      { date: "2026-10-12", analyses: 4, score: 50 },
    ])
  })
})
