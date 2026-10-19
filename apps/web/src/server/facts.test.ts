import { describe, expect, it } from "vitest"
import type { AdaptationDraft } from "@uyarla/core/schemas/adaptation"
import { forgetInDraft } from "@/server/facts"

const draft = {
  summary: { original: null, rewritten: "", decision: "accepted" },
  bullets: [],
  skillOrder: [],
  contributions: [
    { id: "c-1", requirementIndex: 0, experienceIndex: 0, answer: "a", status: "done", text: "t", decision: "accepted" },
  ],
} as unknown as AdaptationDraft

describe("forgetInDraft", () => {
  it("marks the contribution forgotten and leaves the rest of the draft", () => {
    const next = forgetInDraft(draft, "c-1")!
    expect(next.contributions![0]).toMatchObject({ id: "c-1", forgotten: true, decision: "accepted", text: "t" })
    expect(next.bullets).toBe(draft.bullets)
  })

  it("is null for an unknown or already forgotten contribution", () => {
    expect(forgetInDraft(draft, "yok")).toBeNull()
    expect(forgetInDraft(forgetInDraft(draft, "c-1")!, "c-1")).toBeNull()
  })
})
