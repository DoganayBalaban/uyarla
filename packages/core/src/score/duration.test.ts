import { describe, expect, it } from "vitest"
import { experienceMonths, parseMonth, requiredYears } from "./duration.js"

const NOW = new Date("2026-10-15T12:00:00Z")
const m = (year: number, month: number) => year * 12 + (month - 1)

describe("requiredYears", () => {
  it("reads the minimum years a requirement asks for", () => {
    expect(requiredYears("En az 2 yıl yazılım test deneyimi")).toBe(2)
    expect(requiredYears("3+ years of experience with React")).toBe(3)
    expect(requiredYears("2-3 yıl muhasebe deneyimi")).toBe(2)
    expect(requiredYears("Minimum 5 yıllık satış deneyimi")).toBe(5)
    expect(requiredYears("1 yıldan fazla deneyim")).toBe(1)
  })

  it("is null when no duration is asked", () => {
    expect(requiredYears("Python bilgisi")).toBeNull()
    expect(requiredYears("2026 yılında mezun olacak")).toBeNull()
  })
})

describe("parseMonth", () => {
  it("understands the formats CVs use", () => {
    expect(parseMonth("Sep 2025", NOW)).toBe(m(2025, 9))
    expect(parseMonth("Mart 2023", NOW)).toBe(m(2023, 3))
    expect(parseMonth("Eylül 2021", NOW)).toBe(m(2021, 9))
    expect(parseMonth("01/2022", NOW)).toBe(m(2022, 1))
    expect(parseMonth("2022-07", NOW)).toBe(m(2022, 7))
    // Yalnız yıl: ortası. Başı-sonu seçmek süreyi şişirip uydurmaya kayar.
    expect(parseMonth("2021", NOW)).toBe(m(2021, 7))
    expect(parseMonth("2023'ten beri", NOW)).toBe(m(2023, 7))
  })

  it("treats 'present' as now", () => {
    for (const word of ["halen", "Halen", "Present", "Günümüz", "devam ediyor", "Current"]) {
      expect(parseMonth(word, NOW)).toBe(m(2026, 10))
    }
  })

  it("is null when it cannot tell", () => {
    expect(parseMonth("", NOW)).toBeNull()
    expect(parseMonth("bir süre", NOW)).toBeNull()
  })
})

describe("experienceMonths", () => {
  it("adds roles and counts overlaps once", () => {
    const months = experienceMonths(
      [
        { startDate: "Sep 2025", endDate: "Present" }, // Eyl 2025 – Eki 2026: 14
        { startDate: "Apr 2025", endDate: "Aug 2025" }, // Nis – Ağu 2025: 5
        { startDate: "Jun 2025", endDate: "Jul 2025" }, // çakışıyor, eklemez
      ],
      NOW,
    )
    expect(months).toBe(19)
  })

  it("is null when no role has readable dates", () => {
    expect(experienceMonths([{ startDate: "", endDate: "" }], NOW)).toBeNull()
  })
})
