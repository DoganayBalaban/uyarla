import { describe, expect, it } from "vitest"
import {
  daysUntil,
  deadlineBadge,
  groupByStage,
  isStage,
  positionName,
  scoreBadge,
  toBoardCard,
  todayInTurkey,
  type BoardRow,
} from "@/features/applications/board"

function row(suffix: Partial<BoardRow> = {}): BoardRow {
  return {
    id: "a1",
    score: 47.6,
    stage: "saved",
    stageChangedAt: null,
    note: null,
    interviewAt: null,
    followUps: null,
    createdAt: new Date("2026-09-20T10:00:00Z"),
    jobPosting: { position: "Frontend Geliştirici", company: null, rawText: "ilan", deadline: null },
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

describe("toBoardCard · company (DOG-64)", () => {
  it("carries the company extracted from the posting", () => {
    const card = toBoardCard(row({ jobPosting: { position: "Muhasebe Uzmanı", company: " Mimeda ", rawText: "ilan", deadline: null } }))
    expect(card.company).toBe("Mimeda")
  })

  it("leaves the company empty when the posting has none", () => {
    expect(toBoardCard(row()).company).toBeNull()
    expect(toBoardCard(row({ jobPosting: { position: "X", company: "  ", rawText: "ilan", deadline: null } })).company).toBeNull()
  })
})

describe("scoreBadge", () => {
  it("uses the same thresholds as the analysis result", () => {
    // DOG-72: sonuç ve panoda 36 "Yüksek uyum", başvuru panosunda "Düşük" idi.
    expect(scoreBadge(36).text).toBe("Yüksek")
    expect(scoreBadge(25).text).toBe("Orta")
    expect(scoreBadge(10).text).toBe("Düşük")
  })
})

describe("board · interview date (DOG-98)", () => {
  it("carries the interview day as YYYY-MM-DD", () => {
    expect(toBoardCard(row({ interviewAt: new Date("2026-10-21T00:00:00Z") })).interviewAt).toBe("2026-10-21")
    expect(toBoardCard(row()).interviewAt).toBeNull()
  })
})

describe("son başvuru tarihi (DOG-120)", () => {
  // 20 Ekim 2026, 23:30 UTC: Türkiye'de 21 Ekim.
  const NOW = new Date("2026-10-20T23:30:00Z")

  it("counts days in Turkish time", () => {
    expect(todayInTurkey(NOW)).toBe("2026-10-21")
    expect(daysUntil("2026-10-21", NOW)).toBe(0)
    expect(daysUntil("2026-10-24", NOW)).toBe(3)
    expect(daysUntil("2026-10-20", NOW)).toBe(-1)
  })

  it("carries the deadline onto the card", () => {
    const card = toBoardCard(row({ jobPosting: { position: "X", company: null, rawText: "ilan", deadline: new Date("2026-10-25T00:00:00Z") } }))
    expect(card.deadline).toBe("2026-10-25")
  })

  it("badges soon, later, today and past, only while saved", () => {
    expect(deadlineBadge({ deadline: "2026-10-24", stage: "saved" }, NOW)).toEqual({ text: "Son gün 24 Eki · 3 gün kaldı", tone: "soon" })
    expect(deadlineBadge({ deadline: "2026-10-21", stage: "saved" }, NOW)).toEqual({ text: "Son gün bugün", tone: "soon" })
    expect(deadlineBadge({ deadline: "2026-11-30", stage: "saved" }, NOW)).toEqual({ text: "Son gün 30 Kas", tone: "later" })
    expect(deadlineBadge({ deadline: "2026-10-15", stage: "saved" }, NOW)).toEqual({ text: "Süresi doldu (15 Eki)", tone: "past" })
    expect(deadlineBadge({ deadline: "2026-10-24", stage: "applied" }, NOW)).toBeNull()
    expect(deadlineBadge({ deadline: null, stage: "saved" }, NOW)).toBeNull()
  })

  it("puts saved cards with a near deadline on top, nearest first", () => {
    const card = (id: string, deadline: string | null, changed: string) =>
      ({ ...toBoardCard(row({ id, stageChangedAt: new Date(changed) })), deadline })
    const columns = groupByStage(
      [
        card("yeni", null, "2026-10-20T10:00:00Z"),
        card("uzak", "2026-11-30", "2026-10-19T10:00:00Z"),
        card("yakin", "2026-10-23", "2026-10-01T10:00:00Z"),
        card("enYakin", "2026-10-22", "2026-10-02T10:00:00Z"),
        card("gecmis", "2026-10-10", "2026-10-03T10:00:00Z"),
      ],
      NOW,
    )
    expect(columns.saved.map((k) => k.analysisId)).toEqual(["enYakin", "yakin", "yeni", "uzak", "gecmis"])
  })
})
