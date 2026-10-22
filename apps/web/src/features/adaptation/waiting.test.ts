import { describe, expect, it } from "vitest"
import { waitingPreview } from "@/features/adaptation/waiting"

const STARTED = new Date("2026-10-22T10:00:00Z")

const profile = {
  headline: "Performans pazarlama uzmanı",
  summary: "E-ticarette   dört yıllık\nperformans pazarlaması deneyimi.",
  experience: [
    { bullets: [{ text: "Meta kampanyalarını yönettim." }, { text: "  " }, { text: "ROAS'ı 4,1'den 5,3'e çıkardım." }] },
    { bullets: Array.from({ length: 10 }, (_, i) => ({ text: `Madde ${i + 1}` })) },
  ],
}

const requirement = (missingConcepts: string[], type = "skill") => ({
  status: missingConcepts.length ? "missing" : "matched",
  requirement: { text: "x", type, importance: "must", concepts: [] },
  missingConcepts,
})

describe("waitingPreview (bekleme ekranı)", () => {
  it("takes the summary and the first bullets, cleaned and capped", () => {
    const p = waitingPreview(profile, null, STARTED)
    expect(p.headline).toBe("Performans pazarlama uzmanı")
    expect(p.lines[0]).toBe("E-ticarette dört yıllık performans pazarlaması deneyimi.")
    expect(p.lines[1]).toBe("Meta kampanyalarını yönettim.")
    expect(p.lines).not.toContain("")
    expect(p.lines).toHaveLength(7)
    expect(p.startedAt).toBe("2026-10-22T10:00:00.000Z")
  })

  it("shortens very long lines", () => {
    const long = "a ".repeat(200)
    const p = waitingPreview({ headline: null, summary: long, experience: [] }, null, STARTED)
    expect(p.lines[0]!.length).toBeLessThanOrEqual(140)
    expect(p.lines[0]!.endsWith("…")).toBe(true)
  })

  it("lists the analysis' missing concepts without the ones only a marked requirement lacked", () => {
    const result = {
      score: 40,
      requirements: [requirement(["GA4"]), requirement(["Figma"])],
      missingKeywords: ["GA4", "Figma"],
      excluded: [1],
    }
    expect(waitingPreview(profile, result, STARTED).missing).toEqual(["GA4"])
  })

  it("survives a missing profile and an unreadable result", () => {
    const p = waitingPreview(null, { bozuk: true }, STARTED)
    expect(p).toEqual({ headline: null, lines: [], missing: [], startedAt: STARTED.toISOString() })
  })
})
