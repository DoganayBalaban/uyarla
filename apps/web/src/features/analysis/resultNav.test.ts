import { describe, expect, it } from "vitest"
import { navStatus, resultNav } from "@/features/analysis/resultNav"

const r = (importance: string, status: string) => ({ requirement: { importance }, status })

describe("result nav (DOG-131)", () => {
  it("counts musts and nice-to-haves with progress, then title, format, conditions and keywords", () => {
    const items = resultNav({
      requirements: [r("must", "matched"), r("must", "missing"), r("must", "missing"), r("nice", "matched")],
      titleMissing: true,
      formatFindings: 2,
      conditionsToCheck: 1,
      missingKeywords: 4,
    })
    expect(items.map((i) => [i.key, i.issues, navStatus(i)])).toEqual([
      ["must", 2, "2 eksik"],
      ["nice", 0, "tamam"],
      ["title", 1, "geçmiyor"],
      ["format", 2, "2 öneri"],
      ["conditions", 1, "1 kontrol et"],
      ["keywords", 4, "4 eksik"],
    ])
    expect(items[0]).toMatchObject({ target: "gereksinimler", progress: { done: 1, total: 3 }, filterMissing: true })
  })

  it("leaves out what the analysis does not have", () => {
    const items = resultNav({ requirements: [r("must", "matched")], titleMissing: null, formatFindings: null, conditionsToCheck: 0, missingKeywords: 0 })
    expect(items.map((i) => i.key)).toEqual(["must", "keywords"])
  })
})
