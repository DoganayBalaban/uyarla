import { describe, expect, it } from "vitest"
import { canSave, groupApplications, isFirstSaved, nextDefaultId } from "@/server/resumeLibrary"

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

describe("groupApplications (DOG-137)", () => {
  const app = (resumeId: string, n: number) => ({ resumeId, analysisId: `a${n}`, position: `Rol ${n}`, company: null, stage: "saved" })

  it("groups by CV, keeps the newest three and counts all", () => {
    const out = groupApplications([app("r1", 1), app("r2", 2), app("r1", 3), app("r1", 4), app("r1", 5)])
    expect(out.get("r1")).toEqual({
      applications: [
        { analysisId: "a1", position: "Rol 1", company: null, stage: "saved" },
        { analysisId: "a3", position: "Rol 3", company: null, stage: "saved" },
        { analysisId: "a4", position: "Rol 4", company: null, stage: "saved" },
      ],
      applicationCount: 4,
    })
    expect(out.get("r2")?.applicationCount).toBe(1)
    expect(out.has("r3")).toBe(false)
  })
})
