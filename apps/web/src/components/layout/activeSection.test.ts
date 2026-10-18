import { describe, expect, it } from "vitest"
import { activeSection } from "@/components/layout/activeSection"

const sections = [
  { id: "nasil", top: 1000 },
  { id: "ozellikler", top: 2000 },
  { id: "sss", top: 5000 },
]

describe("activeSection", () => {
  it("is empty above the first section (hero)", () => {
    expect(activeSection(sections, 400)).toBeNull()
  })

  it("picks the last section whose top has passed the line", () => {
    expect(activeSection(sections, 1000)).toBe("nasil")
    expect(activeSection(sections, 1999)).toBe("nasil")
    expect(activeSection(sections, 3500)).toBe("ozellikler")
    expect(activeSection(sections, 9000)).toBe("sss")
  })

  it("does not depend on the input order", () => {
    expect(activeSection([...sections].reverse(), 2500)).toBe("ozellikler")
  })
})
