import { describe, expect, it } from "vitest"
import { applyCardChange } from "@/features/applications/api"
import type { BoardCard } from "@/features/applications/board"

const card = (analysisId: string, extra: Partial<BoardCard> = {}) =>
  ({ analysisId, stage: "saved", stageChangedAt: "2026-01-01T00:00:00.000Z", noteText: null, ...extra }) as BoardCard

describe("applyCardChange", () => {
  const now = new Date("2026-10-01T10:00:00.000Z")

  it("moves only the changed card and stamps the time", () => {
    const [a, b] = applyCardChange([card("a"), card("b")], "a", { stage: "applied" }, now)
    expect(a).toMatchObject({ stage: "applied", stageChangedAt: "2026-10-01T10:00:00.000Z" })
    expect(b).toEqual(card("b"))
  })

  it("updates the note without touching the stage", () => {
    const [a] = applyCardChange([card("a")], "a", { note: "İK aradı" }, now)
    expect(a).toMatchObject({ noteText: "İK aradı", stage: "saved", stageChangedAt: "2026-01-01T00:00:00.000Z" })
  })

  it("stores an emptied note as null", () => {
    const [a] = applyCardChange([card("a", { noteText: "eski" })], "a", { note: "" }, now)
    expect(a!.noteText).toBeNull()
  })
})
