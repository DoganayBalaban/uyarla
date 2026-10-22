import { describe, expect, it } from "vitest"
import { prepWaitingPreview } from "@/features/applications/prepWaiting"

const missing = (text: string, importance = "must", type = "skill") => ({
  status: "missing",
  requirement: { text, importance, type },
})

describe("prepWaitingPreview (mülakat bekleme ekranı)", () => {
  it("takes the CV's summary and bullets and at most three unmet must requirements", () => {
    const profile = { headline: null, summary: "Muhasebe uzmanı.", experience: [{ bullets: [{ text: "Ay sonu kapanışlarını yaptım." }] }] }
    const result = {
      requirements: [
        missing("SAP deneyimi"),
        missing("İngilizce", "nice"),
        missing("Ekip çalışması", "must", "soft"),
        missing("IFRS bilgisi"),
        missing("Ehliyet", "must", "condition"),
        missing("Excel"),
        missing("Vergi mevzuatı"),
      ],
      scoringRevision: 2,
    }
    expect(prepWaitingPreview(profile, result)).toEqual({
      lines: ["Muhasebe uzmanı.", "Ay sonu kapanışlarını yaptım."],
      gaps: ["SAP deneyimi", "IFRS bilgisi", "Excel"],
    })
  })

  it("is empty for a missing profile and result", () => {
    expect(prepWaitingPreview(null, null)).toEqual({ lines: [], gaps: [] })
  })
})
