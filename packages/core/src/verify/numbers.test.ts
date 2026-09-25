import { describe, it, expect } from "vitest"
import { checkNumbers } from "./numbers.js"

describe("checkNumbers", () => {
  it("kaynaktaki sayı korunduğunda uyarı üretmez", () => {
    expect(
      checkNumbers(
        "Sayfa yüklenme süresini %40 düşürdüm",
        "Sayfa yüklenme süresini %40 düşürdüm",
      ),
    ).toEqual([])
  })

  it("sayı değiştirildiğinde uyarı üretir", () => {
    const uyarilar = checkNumbers(
      "Sayfa yüklenme süresini %60 düşürdüm",
      "Sayfa yüklenme süresini %40 düşürdüm",
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.kind).toBe("number_mismatch")
    expect(uyarilar[0]!.detail).toContain("60")
  })

  it("yeni sayı eklendiğinde uyarı üretir", () => {
    const uyarilar = checkNumbers(
      "4 kişilik ekipte React ile panel geliştirdim",
      "React ile panel geliştirdim",
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.detail).toContain("4")
  })

  it("kaynaktaki sayının düşürülmesi uyarı üretmez", () => {
    // Bilgi eksiltmek uydurma değil; kullanıcı zaten farkı görüyor.
    expect(
      checkNumbers("React ile panel geliştirdim", "4 kişilik ekipte React ile panel geliştirdim"),
    ).toEqual([])
  })

  it("ondalık sayıları tanır", () => {
    const uyarilar = checkNumbers("Skoru 9,4'e çıkardım", "Skoru 8,2'ye çıkardım")
    expect(uyarilar).toHaveLength(1)
  })

  it("ondalık ayıracının değişmesini uydurma saymaz", () => {
    expect(checkNumbers("Skoru 9.4'e çıkardım", "Skoru 9,4'e çıkardım")).toEqual([])
  })

  it("aynı sayı birden çok kez geçse tek uyarı üretir", () => {
    const uyarilar = checkNumbers("%60 ve yine %60", "%40 düşürdüm")
    expect(uyarilar).toHaveLength(1)
  })

  it("yıl ve tarih gibi sayıları da kontrol eder", () => {
    expect(checkNumbers("2021 yılında mezun oldum", "2020 yılında mezun oldum")).toHaveLength(1)
  })

  it("gerekçe kullanıcıya gösterilebilir Türkçe olur", () => {
    const uyari = checkNumbers("%60 düşürdüm", "%40 düşürdüm")[0]!
    expect(uyari.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(uyari.detail).not.toMatch(/error|mismatch|invalid/i)
  })
})
