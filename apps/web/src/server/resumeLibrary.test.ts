import { describe, expect, it } from "vitest"
import { canSave, isFirstSaved, nextDefaultId } from "@/server/resumeLibrary"

describe("library rules", () => {
  it("allows saving up to five CVs", () => {
    expect(canSave(0)).toBe(true)
    expect(canSave(4)).toBe(true)
    expect(canSave(5)).toBe(false)
  })

  it("makes the first saved CV the default", () => {
    expect(isFirstSaved(0)).toBe(true)
    expect(isFirstSaved(1)).toBe(false)
  })

  it("hands the default to the newest remaining CV, or nobody", () => {
    const old = { id: "old", savedAt: new Date("2026-10-01") }
    const fresh = { id: "new", savedAt: new Date("2026-10-05") }
    expect(nextDefaultId([old, fresh])).toBe("new")
    expect(nextDefaultId([])).toBeNull()
  })
})
