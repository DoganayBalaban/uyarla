import { describe, expect, it } from "vitest"
import { REMINDER_DAYS, REMINDER_WINDOW_DAYS, reminderWhere } from "@/server/applicationReminders"

describe("reminderWhere", () => {
  it("looks at applied cards quiet for a week but not older than the window", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const where = reminderWhere(now) as { stageChangedAt: { lte: Date; gte: Date } }
    expect(where.stageChangedAt.lte.getTime()).toBe(now.getTime() - REMINDER_DAYS * 86400000)
    expect(where.stageChangedAt.gte.getTime()).toBe(now.getTime() - REMINDER_WINDOW_DAYS * 86400000)
  })
})
