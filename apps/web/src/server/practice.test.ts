import { describe, expect, it } from "vitest"
import type { InterviewPrepRecord } from "@uyarla/core/interview/prep"
import { addPractice } from "@/server/practice"

const prep = { questions: [{ question: "Q1" }, { question: "Q2" }], consistency: [], bridges: [], askThem: [] }
const record = (practice: InterviewPrepRecord["practice"] = []): InterviewPrepRecord =>
  ({ status: "done", createdAt: "", attempts: 1, prep, practice }) as never
const now = new Date("2026-10-20T10:00:00Z")
const entry = (questionIndex: number, status: "running" | "done" | "failed") => ({ id: "x", questionIndex, answer: "a", status, createdAt: "" })

describe("addPractice", () => {
  it("adds a running entry and keeps the rest of the record", () => {
    const out = addPractice(record([entry(1, "done")]), { questionIndex: 0, answer: "cevap" }, "p1", now)
    expect(out).toMatchObject({ entry: { id: "p1", status: "running" }, record: { status: "done", prep, practice: [{ questionIndex: 1 }, { id: "p1" }] } })
  })

  it("needs a prep and an existing question", () => {
    expect(addPractice(null, { questionIndex: 0, answer: "a" }, "p", now)).toEqual({ error: "no_prep" })
    expect(addPractice(record(), { questionIndex: 5, answer: "a" }, "p", now)).toEqual({ error: "no_question" })
  })

  it("limits per question and blocks a second running entry; failed ones don't count", () => {
    expect(addPractice(record([entry(0, "running")]), { questionIndex: 0, answer: "a" }, "p", now)).toEqual({ error: "already_running" })
    const three = [entry(0, "done"), entry(0, "done"), entry(0, "done")]
    expect(addPractice(record(three), { questionIndex: 0, answer: "a" }, "p", now)).toEqual({ error: "too_many" })
    expect("entry" in addPractice(record([...three.slice(1), entry(0, "failed")]), { questionIndex: 0, answer: "a" }, "p", now)).toBe(true)
    expect("entry" in addPractice(record(three), { questionIndex: 1, answer: "a" }, "p", now)).toBe(true)
  })
})
