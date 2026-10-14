import { describe, expect, it } from "vitest"
import { createAutoSubmitGate, readExtensionHandoff, shouldAutoSubmit } from "@/features/analysis/extensionHandoff"

const TEXT = "Muhasebe Uzmanı — Mimeda\n\nGenel muhasebe süreçleri, Logo ERP, 3 yıl deneyim, MS Excel orta seviye."
const hash = (text: string, source?: string) =>
  `#ilan=${encodeURIComponent(text)}${source ? `&kaynak=${encodeURIComponent(source)}` : ""}`

describe("readExtensionHandoff", () => {
  it("reads the posting text and its source page", () => {
    expect(readExtensionHandoff(hash(TEXT, "https://www.kariyer.net/is-ilani/x-1"), "")).toEqual({
      jobText: TEXT,
      sourceUrl: "https://www.kariyer.net/is-ilani/x-1",
    })
  })

  it("round-trips special characters", () => {
    // Review Focus 1: + % & # ve Türkçe harf bozulmamalı.
    const tricky = `${TEXT} C++ & %50 prim #1 İşçi ğüşöç`
    expect(readExtensionHandoff(hash(tricky), "")!.jobText).toBe(tricky)
  })

  it("ignores a missing, short or malformed handoff", () => {
    expect(readExtensionHandoff("", "")).toBeNull()
    expect(readExtensionHandoff("#baska=1", "")).toBeNull()
    expect(readExtensionHandoff(hash("kısa"), "")).toBeNull()
    expect(readExtensionHandoff("#ilan=%E0%A4%A", "")).toBeNull()
  })

  it("ignores the handoff on a saved-result address", () => {
    // Review Focus 4: ?analiz= sonucu gösteriyor; form doldurulmaz.
    expect(readExtensionHandoff(hash(TEXT), "?analiz=abc")).toBeNull()
  })

  it("drops a source that is not an http(s) address", () => {
    expect(readExtensionHandoff(hash(TEXT, "javascript:alert(1)"), "")!.sourceUrl).toBeNull()
  })
})

describe("shouldAutoSubmit", () => {
  it("submits for a registered user with a preselected resume", () => {
    expect(shouldAutoSubmit({ registered: true, resumeId: "r1", jobText: TEXT })).toBe(true)
  })

  it("waits for an anonymous user or a missing resume", () => {
    // Review Focus 3.
    expect(shouldAutoSubmit({ registered: false, resumeId: "r1", jobText: TEXT })).toBe(false)
    expect(shouldAutoSubmit({ registered: true, resumeId: undefined, jobText: TEXT })).toBe(false)
  })
})

describe("createAutoSubmitGate", () => {
  it("opens once", () => {
    // Review Focus 2: Strict Mode efekti iki kez çalıştırsa da tek gönderim.
    const gate = createAutoSubmitGate()
    expect(gate()).toBe(true)
    expect(gate()).toBe(false)
  })
})
