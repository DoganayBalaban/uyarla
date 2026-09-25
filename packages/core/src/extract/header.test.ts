import { describe, it, expect } from "vitest"
import { parseHeader } from "./header.js"

describe("parseHeader", () => {
  it("ilk satırı ad olarak alır", () => {
    expect(parseHeader("Elif Yılmaz\nFrontend Geliştirici").fullName).toBe("Elif Yılmaz")
  })

  it("kalan satırları başlık satırında birleştirir", () => {
    const h = parseHeader(
      "Elif Yılmaz\nFrontend Geliştirici\nİstanbul • github.com/elif",
    )
    expect(h.headline).toBe("Frontend Geliştirici · İstanbul • github.com/elif")
  })

  it("boş satırları atlar", () => {
    const h = parseHeader("\n\nElif Yılmaz\n\n\nFrontend Geliştirici\n\n")
    expect(h.fullName).toBe("Elif Yılmaz")
    expect(h.headline).toBe("Frontend Geliştirici")
  })

  it("belge başlığını ad sanmaz", () => {
    // Bazı CV'ler "ÖZGEÇMİŞ" ya da "CURRICULUM VITAE" ile başlıyor.
    expect(parseHeader("ÖZGEÇMİŞ\nElif Yılmaz\nGeliştirici").fullName).toBe("Elif Yılmaz")
    expect(parseHeader("Curriculum Vitae\nElif Yılmaz").fullName).toBe("Elif Yılmaz")
  })

  it("e-posta satırını ad sanmaz", () => {
    // Bazı CV'lerde iletişim bilgisi en üstte. Yanlış ad, CV'nin en görünür
    // yerinde yanlış bilgi demek — ad bulunamadıysa null daha dürüst.
    const h = parseHeader("elif@ornek.com\nFrontend Geliştirici")
    expect(h.fullName).toBeNull()
    expect(h.headline).toBe("elif@ornek.com · Frontend Geliştirici")
  })

  it("bağlantı satırını ad sanmaz", () => {
    expect(parseHeader("github.com/elif\nElif Yılmaz").fullName).toBeNull()
  })

  it("telefon satırını ad sanmaz", () => {
    expect(parseHeader("+90 555 123 45 67\nElif Yılmaz").fullName).toBeNull()
  })

  it("çok uzun satırı ad sanmaz", () => {
    const uzun = "Bu satır bir isim değil, bir cümle gibi uzun ve açıklama içeriyor demek"
    expect(parseHeader(uzun).fullName).toBeNull()
  })

  it("kısaltılmış adı kabul eder", () => {
    // Anonimleştirilmiş CV'lerde "A. B." biçimi var.
    expect(parseHeader("A. B.\nAI Engineer").fullName).toBe("A. B.")
  })

  it("başlık satırı yoksa null döner", () => {
    expect(parseHeader("Elif Yılmaz")).toEqual({ fullName: "Elif Yılmaz", headline: null })
  })

  it("boş blokta iki alan da null", () => {
    expect(parseHeader("")).toEqual({ fullName: null, headline: null })
    expect(parseHeader("   \n\n  ")).toEqual({ fullName: null, headline: null })
  })

  it("başlık satırını makul uzunlukta tutar", () => {
    // Bölümleme başlık bulamazsa tüm CV buraya düşebilir; belgenin tepesine
    // sayfalarca metin yazmayalım.
    const cok = Array.from({ length: 20 }, (_, i) => `satır ${i}`).join("\n")
    expect(parseHeader(cok).headline!.split(" · ")).toHaveLength(3)
  })
})
