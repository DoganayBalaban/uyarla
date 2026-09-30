import { describe, it, expect } from "vitest"
import { checkNumbers } from "./numbers.js"

describe("checkNumbers", () => {
  it("produces no warning when a source number is kept", () => {
    expect(
      checkNumbers(
        "Sayfa yüklenme süresini %40 düşürdüm",
        "Sayfa yüklenme süresini %40 düşürdüm",
      ),
    ).toEqual([])
  })

  it("warns when a number is changed", () => {
    const warnings = checkNumbers(
      "Sayfa yüklenme süresini %60 düşürdüm",
      "Sayfa yüklenme süresini %40 düşürdüm",
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.kind).toBe("number_mismatch")
    expect(warnings[0]!.detail).toContain("60")
  })

  it("warns when a new number is added", () => {
    const warnings = checkNumbers(
      "4 kişilik ekipte React ile panel geliştirdim",
      "React ile panel geliştirdim",
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.detail).toContain("4")
  })

  it("dropping a source number produces no warning", () => {
    // Bilgi eksiltmek uydurma değil; kullanıcı zaten farkı görüyor.
    expect(
      checkNumbers("React ile panel geliştirdim", "4 kişilik ekipte React ile panel geliştirdim"),
    ).toEqual([])
  })

  it("recognizes decimal numbers", () => {
    const warnings = checkNumbers("Skoru 9,4'e çıkardım", "Skoru 8,2'ye çıkardım")
    expect(warnings).toHaveLength(1)
  })

  it("does not treat a changed decimal separator as fabrication", () => {
    expect(checkNumbers("Skoru 9.4'e çıkardım", "Skoru 9,4'e çıkardım")).toEqual([])
  })

  it("produces one warning even if the same number appears several times", () => {
    const warnings = checkNumbers("%60 ve yine %60", "%40 düşürdüm")
    expect(warnings).toHaveLength(1)
  })

  it("also checks numbers such as years and dates", () => {
    expect(checkNumbers("2021 yılında mezun oldum", "2020 yılında mezun oldum")).toHaveLength(1)
  })

  it("the reason is user-facing Turkish", () => {
    const warning = checkNumbers("%60 düşürdüm", "%40 düşürdüm")[0]!
    expect(warning.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(warning.detail).not.toMatch(/error|mismatch|invalid/i)
  })
})
