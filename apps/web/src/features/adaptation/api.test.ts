import { describe, expect, it } from "vitest"
import { adaptationPollDelay } from "@/features/adaptation/api"

const letter = (status: "running" | "done" | "failed") => ({ status }) as never

describe("adaptationPollDelay", () => {
  it("polls quickly while the draft is being written", () => {
    expect(adaptationPollDelay(undefined, null)).toBe(1500)
    expect(adaptationPollDelay({ status: "running", coverLetter: null }, null)).toBe(1500)
  })

  it("polls slower while only the cover letter is running", () => {
    expect(adaptationPollDelay({ status: "draft", coverLetter: letter("running") }, null)).toBe(2000)
  })

  it("stops when nothing is running", () => {
    expect(adaptationPollDelay({ status: "draft", coverLetter: null }, null)).toBe(false)
    expect(adaptationPollDelay({ status: "ready", coverLetter: letter("done") }, null)).toBe(false)
    expect(adaptationPollDelay({ status: "failed", coverLetter: null }, null)).toBe(false)
  })

  it("stops when the request failed", () => {
    expect(adaptationPollDelay(undefined, new Error("404"))).toBe(false)
  })
})
