import { describe, expect, it } from "vitest"
import { MAX_EXTENSION_TEXT, pickPosting, pickSelection, uyarlaUrl } from "./posting.js"

const LONG = "Genel muhasebe süreçlerini yürüteceksin. ".repeat(10)

describe("pickPosting", () => {
  it("returns the posting text found on the page", () => {
    const html = `<html><body><main><h1>Muhasebe Uzmanı</h1><p>${LONG}</p></main></body></html>`
    expect(pickPosting({ html, url: "https://www.yenibiris.com/is-ilani/1" })).toContain("Genel muhasebe")
  })

  it("returns null for a page without a posting", () => {
    expect(pickPosting({ html: "<html><body><p>Giriş yap</p></body></html>", url: "https://x.com" })).toBeNull()
  })
})

describe("pickSelection", () => {
  it("accepts a long enough selection", () => {
    expect(pickSelection(`  ${LONG}  `)).toBe(LONG.trim())
  })

  it("rejects a short, blank or missing selection", () => {
    // Review Focus 5.
    expect(pickSelection("kısa")).toBeNull()
    expect(pickSelection("   \n  ")).toBeNull()
    expect(pickSelection(undefined)).toBeNull()
  })
})

describe("uyarlaUrl", () => {
  it("puts the text and source in the fragment, encoded", () => {
    const url = new URL(uyarlaUrl("https://uyarla.vercel.app", "C++ & %50 #1 İşçi", "https://kariyer.net/a?b=1"))
    expect(url.origin + url.pathname).toBe("https://uyarla.vercel.app/analyze")
    expect(url.search).toBe("")
    const params = new URLSearchParams(url.hash.slice(1))
    expect(params.get("ilan")).toBe("C++ & %50 #1 İşçi")
    expect(params.get("kaynak")).toBe("https://kariyer.net/a?b=1")
  })

  it("leaves the source out when there is none", () => {
    expect(uyarlaUrl("http://localhost:3000", LONG, null)).not.toContain("kaynak=")
  })

  it("caps very long text", () => {
    const url = new URL(uyarlaUrl("https://uyarla.vercel.app", "a".repeat(MAX_EXTENSION_TEXT + 500), null))
    expect(new URLSearchParams(url.hash.slice(1)).get("ilan")!.length).toBe(MAX_EXTENSION_TEXT)
  })

  it("does not split an emoji at the cap", () => {
    const text = "a".repeat(MAX_EXTENSION_TEXT - 1) + "😀 sonrası"
    expect(() => uyarlaUrl("https://uyarla.vercel.app", text, null)).not.toThrow()
  })
})
