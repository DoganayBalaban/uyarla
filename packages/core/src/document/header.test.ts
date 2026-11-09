import { describe, expect, it } from "vitest"
import { documentHeader } from "./header.js"

describe("documentHeader", () => {
  it("splits a pasted line into titles, location and contacts with one separator", () => {
    const h = documentHeader(
      "AI ENGINEER  |  FULL-STACK AI ENGINEER · Istanbul, Türkiye  •  GitHub: github.com/aday  •  Portfolio: aday.example.app •  Medium: @aday · aday@ornek.com",
      "en",
    )
    expect(h.title).toBe("AI Engineer · Full-Stack AI Engineer")
    expect(h.contacts).toEqual([
      { text: "Istanbul, Türkiye", href: null },
      { text: "github.com/aday", href: "https://github.com/aday" },
      { text: "aday.example.app", href: "https://aday.example.app" },
      { text: "Medium: @aday", href: null },
      { text: "aday@ornek.com", href: "mailto:aday@ornek.com" },
    ])
  })

  it("keeps a phone, tidies a spaced label and drops the protocol from links", () => {
    const h = documentHeader("Cairo, Egypt · +201200515902 | ad@ornek.com | LinkedIn : Ad Soyad | https://www.ad.dev/", "en")
    expect(h.title).toBeNull()
    expect(h.contacts.map((c) => c.text)).toEqual(["Cairo, Egypt", "+201200515902", "ad@ornek.com", "LinkedIn: Ad Soyad", "ad.dev"])
  })

  it("leaves a mixed-case title alone and lowercases Turkish capitals correctly", () => {
    expect(documentHeader("Dijital Pazarlama Uzmanı · İstanbul, Türkiye", "tr").title).toBe("Dijital Pazarlama Uzmanı")
    expect(documentHeader("KIDEMLİ YAZILIM MÜHENDİSİ VE EKİP LİDERİ", "tr").title).toBe("Kıdemli Yazılım Mühendisi ve Ekip Lideri")
  })

  it("does not take a comma in a title for a location", () => {
    const h = documentHeader("Senior Engineer, Backend · Ankara, Türkiye", "en")
    expect(h.title).toBe("Senior Engineer, Backend")
    expect(h.contacts).toEqual([{ text: "Ankara, Türkiye", href: null }])
  })

  it("loses nothing: every token ends up somewhere", () => {
    const line = "Veri Bilimci · Uzaktan · x@y.com"
    const h = documentHeader(line, "tr")
    expect([h.title, ...h.contacts.map((c) => c.text)].join(" · ")).toBe("Veri Bilimci · Uzaktan · x@y.com")
  })

  it("returns nothing for an empty line", () => {
    expect(documentHeader(null, "tr")).toEqual({ title: null, contacts: [] })
  })
})
