import { describe, expect, it } from "vitest"
import { jobPollDelay } from "@/features/analysis/api"

describe("jobPollDelay", () => {
  it("keeps polling a running job", () => {
    expect(jobPollDelay({ status: "running" }, null, 1000)).toBe(1000)
    expect(jobPollDelay(undefined, null, 3000)).toBe(3000)
  })

  it("stops once the job is finished", () => {
    expect(jobPollDelay({ status: "completed" }, null, 1000)).toBe(false)
    expect(jobPollDelay({ status: "failed" }, null, 1000)).toBe(false)
  })

  it("stops when the API no longer knows the job", () => {
    expect(jobPollDelay(undefined, 404, 1000)).toBe(false)
    expect(jobPollDelay({ status: "running" }, 401, 1000)).toBe(false)
  })

  it("keeps polling through a network outage", () => {
    // Yanıt gelmedi (durum kodu yok): bir sonraki turda tekrar sorulur.
    expect(jobPollDelay({ status: "running" }, null, 1000)).toBe(1000)
  })
})
