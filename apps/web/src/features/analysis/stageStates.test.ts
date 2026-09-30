import { describe, expect, it } from "vitest"
import { deriveStageStates as deriveStageStates } from "@/features/analysis/stageStates"

const T = [{ id: "a", title: "A" }, { id: "b", title: "B" }, { id: "c", title: "C" }]
const statuses = (x: { status: string }[]) => x.map((a) => a.status)

describe("deriveStageStates", () => {
  it("stages before the active one are done, later ones pending", () => {
    expect(statuses(deriveStageStates(T, "b"))).toEqual(["done", "active", "pending"])
  })
  it("the first stage is active when the stage is unknown", () => {
    expect(statuses(deriveStageStates(T, null))).toEqual(["active", "pending", "pending"])
  })
  it("all are done when finished", () => {
    expect(statuses(deriveStageStates(T, "c", true))).toEqual(["done", "done", "done"])
  })
})
