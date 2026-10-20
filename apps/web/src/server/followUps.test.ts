import { describe, expect, it } from "vitest"
import { addFollowUp } from "@/server/followUps"

const NOW = new Date("2026-10-20T10:00:00Z")

describe("addFollowUp (DOG-117)", () => {
  it("adds a running draft and allows two per kind; failed ones do not count", () => {
    const first = addFollowUp(null, { kind: "followup", channel: "email" }, "f1", NOW)
    if ("error" in first) throw new Error("beklenmedik")
    expect(first.record).toMatchObject({ id: "f1", kind: "followup", status: "running" })
    const done = first.list.map((f) => ({ ...f, status: "done" as const }))
    const failed = [...done, { ...done[0]!, id: "f0", status: "failed" as const }]
    const second = addFollowUp(failed, { kind: "followup", channel: "linkedin" }, "f2", NOW)
    if ("error" in second) throw new Error("beklenmedik")
    const third = addFollowUp(second.list.map((f) => ({ ...f, status: "done" as const })), { kind: "followup", channel: "email" }, "f3", NOW)
    expect(third).toEqual({ error: "too_many" })
    // Teşekkür notunun hakkı ayrı.
    expect("error" in addFollowUp(second.list, { kind: "thanks", channel: "email" }, "t1", NOW)).toBe(false)
  })

  it("refuses a second request while one is being written", () => {
    const first = addFollowUp([], { kind: "thanks", channel: "email" }, "t1", NOW)
    if ("error" in first) throw new Error("beklenmedik")
    expect(addFollowUp(first.list, { kind: "thanks", channel: "linkedin" }, "t2", NOW)).toEqual({ error: "already_running" })
  })
})

describe("addFollowUp outreach (DOG-99)", () => {
  it("keeps the outreach choices and defaults, and drops them from other kinds", () => {
    const out = addFollowUp(null, { kind: "outreach", channel: "linkedin", purpose: "chat", note: "Aynı üniversite", applied: true }, "o1", NOW)
    if ("error" in out) throw new Error("beklenmedik")
    expect(out.record).toMatchObject({ kind: "outreach", recipient: "recruiter", purpose: "chat", note: "Aynı üniversite", applied: true })
    const other = addFollowUp(null, { kind: "followup", channel: "email", note: "x", recipient: "team" }, "f1", NOW)
    if ("error" in other) throw new Error("beklenmedik")
    expect(other.record).not.toHaveProperty("note")
    expect(other.record).not.toHaveProperty("recipient")
  })
})

describe("addFollowUp keeps records it does not know", () => {
  it("appends to the raw list", () => {
    const unknown = { id: "x", kind: "gelecekteki-tür" }
    const out = addFollowUp([unknown], { kind: "followup", channel: "email" }, "f1", NOW)
    if ("error" in out) throw new Error("beklenmedik")
    expect(out.list.map((f) => f.id)).toEqual(["x", "f1"])
  })
})
