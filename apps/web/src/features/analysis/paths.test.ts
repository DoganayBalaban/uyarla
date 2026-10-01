import { describe, expect, it } from "vitest"
import { resultPath } from "@/features/analysis/paths"

describe("resultPath", () => {
  it("produces the permanent result path", () => {
    expect(resultPath("an 1")).toBe("/analyze?analiz=an%201")
  })
})
