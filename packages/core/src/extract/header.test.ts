import { describe, it, expect } from "vitest"
import { parseHeader } from "./header.js"

describe("parseHeader", () => {
  it("takes the first line as the name", () => {
    expect(parseHeader("Elif Yılmaz\nFrontend Geliştirici").fullName).toBe("Elif Yılmaz")
  })

  it("joins the remaining lines into the headline", () => {
    const h = parseHeader(
      "Elif Yılmaz\nFrontend Geliştirici\nİstanbul • github.com/elif",
    )
    expect(h.headline).toBe("Frontend Geliştirici · İstanbul • github.com/elif")
  })

  it("skips empty lines", () => {
    const h = parseHeader("\n\nElif Yılmaz\n\n\nFrontend Geliştirici\n\n")
    expect(h.fullName).toBe("Elif Yılmaz")
    expect(h.headline).toBe("Frontend Geliştirici")
  })

  it("does not mistake a document title for a name", () => {
    // Bazı CV'ler "ÖZGEÇMİŞ" ya da "CURRICULUM VITAE" ile başlıyor.
    expect(parseHeader("ÖZGEÇMİŞ\nElif Yılmaz\nGeliştirici").fullName).toBe("Elif Yılmaz")
    expect(parseHeader("Curriculum Vitae\nElif Yılmaz").fullName).toBe("Elif Yılmaz")
  })

  it("does not mistake an email line for a name", () => {
    // Bazı CV'lerde iletişim bilgisi en üstte. Yanlış ad, CV'nin en görünür
    // yerinde yanlış bilgi demek — ad bulunamadıysa null daha dürüst.
    const h = parseHeader("elif@ornek.com\nFrontend Geliştirici")
    expect(h.fullName).toBeNull()
    expect(h.headline).toBe("elif@ornek.com · Frontend Geliştirici")
  })

  it("does not mistake a link line for a name", () => {
    expect(parseHeader("github.com/elif\nElif Yılmaz").fullName).toBeNull()
  })

  it("does not mistake a phone line for a name", () => {
    expect(parseHeader("+90 555 123 45 67\nElif Yılmaz").fullName).toBeNull()
  })

  it("does not mistake a very long line for a name", () => {
    const long = "Bu satır bir isim değil, bir cümle gibi uzun ve açıklama içeriyor demek"
    expect(parseHeader(long).fullName).toBeNull()
  })

  it("accepts an abbreviated name", () => {
    // Anonimleştirilmiş CV'lerde "A. B." biçimi var.
    expect(parseHeader("A. B.\nAI Engineer").fullName).toBe("A. B.")
  })

  it("returns null when there is no headline", () => {
    expect(parseHeader("Elif Yılmaz")).toEqual({ fullName: "Elif Yılmaz", headline: null })
  })

  it("both fields are null for an empty block", () => {
    expect(parseHeader("")).toEqual({ fullName: null, headline: null })
    expect(parseHeader("   \n\n  ")).toEqual({ fullName: null, headline: null })
  })

  it("keeps the headline at a reasonable length", () => {
    // Bölümleme başlık bulamazsa tüm CV buraya düşebilir; belgenin tepesine
    // sayfalarca metin yazmayalım.
    const many = Array.from({ length: 20 }, (_, i) => `satır ${i}`).join("\n")
    expect(parseHeader(many).headline!.split(" · ")).toHaveLength(3)
  })
})
