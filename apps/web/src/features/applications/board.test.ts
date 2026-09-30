import { describe, expect, it } from "vitest"
import { isStage as isStage, toBoardCard as toBoardCard, positionName as positionName, groupByStage as groupByStage, type BoardRow as BoardRow } from "@/features/applications/board"

function row(suffix: Partial<BoardRow> = {}): BoardRow {
  return {
    id: "a1",
    score: 47.6,
    stage: "saved",
    stageChangedAt: null,
    note: null,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    jobPosting: { position: "Frontend Geliştirici", rawText: "ilan" },
    adaptation: null,
    ...suffix,
  }
}

describe("board", () => {
  it("stage validation", () => {
    expect(isStage("interview")).toBe(true)
    expect(isStage("hired")).toBe(false)
    expect(isStage(3)).toBe(false)
  })

  it("uses the posting's first line when position is empty", () => {
    expect(positionName("", "\n  Kıdemli Veri Analisti\nAçıklama")).toBe("Kıdemli Veri Analisti")
    expect(positionName("", "")).toBe("İsimsiz ilan")
    expect(positionName("", "x".repeat(100))).toHaveLength(78)
  })

  it("card: score is rounded, unknown stage counts as saved", () => {
    const k = toBoardCard(row({ stage: "eski", adaptation: { id: "ad1", status: "ready" } }))
    expect(k.score).toBe(48)
    expect(k.stage).toBe("saved")
    expect(k.adaptation).toEqual({ id: "ad1", status: "ready" })
  })

  it("groups into columns with the most recently moved on top", () => {
    const cards = [
      toBoardCard(row({ id: "eski", stage: "applied", stageChangedAt: new Date("2026-09-21") })),
      toBoardCard(row({ id: "yeni", stage: "applied", stageChangedAt: new Date("2026-09-25") })),
      toBoardCard(row({ id: "k", stage: "saved" })),
    ]
    const s = groupByStage(cards)
    expect(s.applied.map((k) => k.analysisId)).toEqual(["yeni", "eski"])
    expect(s.saved).toHaveLength(1)
    expect(s.offer).toEqual([])
  })
})
