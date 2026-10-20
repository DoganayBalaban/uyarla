import { describe, expect, it } from "vitest"
import { MAX_FORM_ANSWERS } from "@uyarla/core/cover/formAnswerRecord"
import { addFormAnswer } from "@/server/formAnswers"

const now = new Date("2026-10-20T10:00:00Z")
const rec = (status: "running" | "done" | "failed") => ({ id: "x", question: "Soru?", limit: null, status, createdAt: "" })

describe("addFormAnswer (DOG-123)", () => {
  it("adds a running answer with its limit", () => {
    const out = addFormAnswer(null, { question: "Neden sen?", limit: { unit: "chars", max: 140 } }, "a1", now)
    expect(out).toMatchObject({ record: { id: "a1", status: "running", limit: { unit: "chars", max: 140 } }, list: [{ id: "a1" }] })
  })

  it("one at a time, at most the cap; failed ones don't count", () => {
    expect(addFormAnswer([rec("running")], { question: "?", limit: null }, "a", now)).toEqual({ error: "already_running" })
    const full = Array.from({ length: MAX_FORM_ANSWERS }, () => rec("done"))
    expect(addFormAnswer(full, { question: "?", limit: null }, "a", now)).toEqual({ error: "too_many" })
    expect("record" in addFormAnswer([...full.slice(1), rec("failed")], { question: "?", limit: null }, "a", now)).toBe(true)
  })
})
