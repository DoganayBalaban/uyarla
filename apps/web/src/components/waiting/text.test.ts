import { describe, expect, it } from "vitest"
import { elapsedLabel, previewLines } from "@/components/waiting/text"

describe("elapsedLabel", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(elapsedLabel(0)).toBe("0:00")
    expect(elapsedLabel(9_400)).toBe("0:09")
    expect(elapsedLabel(65_000)).toBe("1:05")
    expect(elapsedLabel(-3_000)).toBe("0:00")
  })
})

describe("previewLines", () => {
  it("keeps the first non-empty lines, whitespace collapsed", () => {
    expect(previewLines("Başlık\r\n\r\n  İstanbul  ·  Hibrit \n\n• React", 2)).toEqual(["Başlık", "İstanbul · Hibrit"])
  })

  it("shortens long lines and handles nothing", () => {
    const [line] = previewLines("x".repeat(200), 1, 20)
    expect(line).toHaveLength(20)
    expect(line!.endsWith("…")).toBe(true)
    expect(previewLines(null)).toEqual([])
    expect(previewLines("\n \n")).toEqual([])
  })
})
