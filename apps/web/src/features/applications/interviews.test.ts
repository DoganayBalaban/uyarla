import { describe, expect, it } from "vitest"
import { prepStatus, type BoardCard } from "@/features/applications/board"
import { daysLabel, interviewGroups } from "@/features/applications/interviews"

const card = (over: Partial<BoardCard>): BoardCard => ({
  analysisId: "a",
  position: "P",
  company: null,
  score: 30,
  stage: "interview",
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

describe("interview hub (DOG-152)", () => {
  const now = new Date("2026-10-22T09:00:00Z")

  it("sorts upcoming by date, keeps undated apart and puts the past aside", () => {
    const g = interviewGroups(
      [
        card({ analysisId: "later", interviewAt: "2026-10-30" }),
        card({ analysisId: "today", interviewAt: "2026-10-22" }),
        card({ analysisId: "nodate" }),
        card({ analysisId: "gone", interviewAt: "2026-10-01" }),
        card({ analysisId: "offer", stage: "offer" }),
        card({ analysisId: "rejected", stage: "rejected", interviewAt: "2026-10-10" }),
        card({ analysisId: "applied", stage: "applied", interviewAt: "2026-10-25" }),
        card({ analysisId: "rejected-no-interview", stage: "rejected" }),
      ],
      now,
    )
    expect(g.upcoming.map((u) => [u.card.analysisId, u.days])).toEqual([
      ["today", 0],
      ["later", 8],
    ])
    expect(g.undated.map((c) => c.analysisId)).toEqual(["nodate"])
    expect(g.past.map((c) => c.analysisId)).toEqual(["rejected", "gone", "offer"])
  })

  it("labels the days left", () => {
    expect([0, 1, 5].map(daysLabel)).toEqual(["Bugün", "Yarın", "5 gün kaldı"])
  })

  it("reads the prep status without the package", () => {
    expect(prepStatus(null)).toBeNull()
    expect(prepStatus({ status: "running", createdAt: "2026-10-22T08:55:00Z" }, now)).toBe("running")
    expect(prepStatus({ status: "running", createdAt: "2026-10-22T08:00:00Z" }, now)).toBe("failed")
    expect(prepStatus({ status: "done", prep: { questions: [] } }, now)).toBe("ready")
    expect(prepStatus({ status: "failed" }, now)).toBe("failed")
  })
})
