import { describe, expect, it } from "vitest"
import { readiness, readinessHint } from "@/features/analysis/readiness"

const req = (text: string, status: "matched" | "missing", importance = "must", type = "technical") => ({
  requirement: { text, importance, type },
  status,
})

describe("readiness (DOG-91)", () => {
  it("is ready when every must is met and the title appears", () => {
    const r = readiness({
      scoringRevision: 2,
      requirements: [req("React", "matched"), req("Next.js", "missing", "nice")],
      titleMatch: { level: "partial", position: "Frontend" },
    })!
    expect(r).toEqual({ ready: true, missingMust: [], titleMissing: false })
    expect(readinessHint(r)).toContain("Başvuruya hazır")
  })

  it("leaves out excluded musts, soft traits and conditions", () => {
    const r = readiness({
      scoringRevision: 2,
      excluded: [0],
      requirements: [req("SAP", "missing"), req("Takım çalışması", "missing", "must", "soft"), req("Ehliyet", "missing", "must", "condition")],
    })!
    expect(r.ready).toBe(true)
  })

  it("names the first missing must and the title in one hint", () => {
    const r = readiness({
      scoringRevision: 2,
      requirements: [req("React", "missing"), req("TypeScript", "missing"), req("Git", "matched")],
      titleMatch: { level: "none", position: "Frontend" },
    })!
    expect(r).toEqual({ ready: false, missingMust: ["React", "TypeScript"], titleMissing: true })
    expect(readinessHint(r)).toBe(
      "Başvurmadan önce 2 zorunlu eksik; en öndeki “React”. İlandaki unvan CV'nde geçmiyor. Deneyiminde varsa CV'nde görünür kılmak skoru en çok artıran adım.",
    )
    expect(readinessHint({ ready: false, missingMust: ["SAP"], titleMissing: false })).toContain("tek bir zorunlu eksik: “SAP”")
  })

  it("ignores the title on old scoring and returns null without a result", () => {
    expect(readiness({ requirements: [], titleMatch: { level: "none", position: "X" } })!.ready).toBe(true)
    expect(readiness(null)).toBeNull()
    expect(readiness({})).toBeNull()
  })
})
