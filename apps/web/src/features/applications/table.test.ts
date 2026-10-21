import { describe, expect, it } from "vitest"
import type { BoardCard } from "@/features/applications/board"
import { filterCards, sortCards } from "@/features/applications/table"

const card = (over: Partial<BoardCard>): BoardCard => ({
  analysisId: "a",
  position: "Frontend Geliştirici",
  company: null,
  score: 30,
  stage: "saved",
  stageChangedAt: null,
  noteText: null,
  interviewAt: null,
  deadline: null,
  followUps: [],
  createdAt: "2026-10-01T10:00:00Z",
  adaptation: null,
  readiness: null,
  ...over,
})

describe("application table (DOG-148)", () => {
  const cards = [
    card({ analysisId: "a", position: "İK Uzmanı", company: "Acme", score: 40, stage: "applied", deadline: "2026-10-30" }),
    card({ analysisId: "b", position: "Muhasebe Uzmanı", score: null, stage: "saved", stageChangedAt: "2026-10-10T00:00:00Z" }),
    card({ analysisId: "c", position: "Frontend Geliştirici", company: "Işık Yazılım", score: 12, stage: "interview", deadline: "2026-10-20" }),
  ]

  it("searches position and company with Turkish casing and filters by stage", () => {
    expect(filterCards(cards, { query: "ik" }).map((c) => c.analysisId)).toEqual(["a"])
    expect(filterCards(cards, { query: "IŞIK" }).map((c) => c.analysisId)).toEqual(["c"])
    expect(filterCards(cards, { stage: "saved" }).map((c) => c.analysisId)).toEqual(["b"])
  })

  it("sorts both ways and keeps empty values last", () => {
    expect(sortCards(cards, "score", "desc").map((c) => c.analysisId)).toEqual(["a", "c", "b"])
    expect(sortCards(cards, "score", "asc").map((c) => c.analysisId)).toEqual(["c", "a", "b"])
    expect(sortCards(cards, "deadline", "asc").map((c) => c.analysisId)).toEqual(["c", "a", "b"])
    expect(sortCards(cards, "stage", "asc").map((c) => c.analysisId)).toEqual(["b", "a", "c"])
    expect(sortCards(cards, "updated", "desc")[0]!.analysisId).toBe("b")
  })
})
