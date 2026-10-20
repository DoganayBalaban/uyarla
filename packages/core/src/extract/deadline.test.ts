import { describe, expect, it } from "vitest"
import { parseDeadline } from "./deadline.js"

const NOW = new Date("2026-10-20T09:00:00Z")

describe("parseDeadline (DOG-120)", () => {
  it("reads numeric dates", () => {
    expect(parseDeadline("Son başvuru tarihi: 25.10.2026", NOW)).toBe("2026-10-25")
    expect(parseDeadline("Son başvuru 05/11/26", NOW)).toBe("2026-11-05")
    expect(parseDeadline("Deadline: 2026-11-30", NOW)).toBe("2026-11-30")
  })

  it("reads Turkish month names, with suffixes and capitals", () => {
    expect(parseDeadline("Son başvuru: 25 Ekim 2026", NOW)).toBe("2026-10-25")
    expect(parseDeadline("Başvurular 3 Kasım'a kadar alınacaktır", NOW)).toBe("2026-11-03")
    expect(parseDeadline("SON BAŞVURU 15 ARALIK", NOW)).toBe("2026-12-15")
  })

  it("reads English dates", () => {
    expect(parseDeadline("Apply by October 31, 2026", NOW)).toBe("2026-10-31")
    expect(parseDeadline("Applications close 12 November", NOW)).toBe("2026-11-12")
    expect(parseDeadline("Deadline: Nov 5th", NOW)).toBe("2026-11-05")
  })

  it("places a date without a year: this year, or next year if long past", () => {
    // Aralık'ta okunan "15 Ocak" gelecek yıl.
    expect(parseDeadline("15 Ocak", new Date("2026-12-20T09:00:00Z"))).toBe("2027-01-15")
    // Kasım başında okunan "25 Ekim" bu yıl: süresi dolmuş.
    expect(parseDeadline("25 Ekim", new Date("2026-11-02T09:00:00Z"))).toBe("2026-10-25")
  })

  it("does not guess", () => {
    expect(parseDeadline("En kısa sürede başvurun", NOW)).toBeNull()
    expect(parseDeadline("2 hafta içinde", NOW)).toBeNull()
    expect(parseDeadline("ASAP", NOW)).toBeNull()
    expect(parseDeadline(null, NOW)).toBeNull()
    expect(parseDeadline("31.02.2026", NOW)).toBeNull()
  })
})
