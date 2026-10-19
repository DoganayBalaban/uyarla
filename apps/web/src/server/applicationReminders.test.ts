import { describe, expect, it } from "vitest"
import { REMINDER_DAYS, REMINDER_WINDOW_DAYS, reminderEmail, reminderWhere } from "@/server/applicationReminders"

describe("reminderEmail (DOG-98)", () => {
  const items = [{ position: "Muhasebe <Uzmanı>", company: "Atlas & Co", appliedAt: new Date("2026-10-10T09:00:00Z") }]

  it("escapes user text in HTML and offers a way to turn reminders off", () => {
    const { html, text, subject } = reminderEmail(items)
    expect(subject).toBe("Başvurularından haber var mı?")
    expect(html).toContain("Muhasebe &lt;Uzmanı&gt;")
    expect(html).toContain("Atlas &amp; Co")
    expect(html).not.toContain("<Uzmanı>")
    expect(html).toContain("/account")
    expect(text).toContain("Muhasebe <Uzmanı> · Atlas & Co")
    expect(text).toContain("/applications")
  })

  it("links the signed one-click page when there is one (DOG-127)", () => {
    const { html, text } = reminderEmail(items, "https://uyarla.com.tr/e-posta/cik?t=abc")
    expect(html).toContain("tek tıkla kapatabilirsin")
    expect(html).toContain("/e-posta/cik?t=abc")
    expect(html).toContain("yanıtlarsan bize ulaşır")
    expect(text).toContain("/e-posta/cik?t=abc")
  })

  it("counts plural applications", () => {
    expect(reminderEmail([...items, ...items]).html).toContain("2 başvurun")
  })
})

describe("reminderWhere", () => {
  it("looks at applied cards quiet for a week but not older than the window", () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const where = reminderWhere(now) as { stageChangedAt: { lte: Date; gte: Date } }
    expect(where.stageChangedAt.lte.getTime()).toBe(now.getTime() - REMINDER_DAYS * 86400000)
    expect(where.stageChangedAt.gte.getTime()).toBe(now.getTime() - REMINDER_WINDOW_DAYS * 86400000)
  })
})
