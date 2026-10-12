import { UnrecoverableError } from "bullmq"
import { describe, expect, it } from "vitest"
import { shouldReport } from "./observability.js"

const job = (attemptsMade: number, attempts = 3) => ({ attemptsMade, opts: { attempts } })

describe("shouldReport", () => {
  it("reports an unexpected error once retries are exhausted", () => {
    expect(shouldReport(job(3), new Error("Redis koptu"))).toBe(true)
  })

  it("does not report an attempt that will be retried", () => {
    expect(shouldReport(job(1), new Error("zaman aşımı"))).toBe(false)
  })

  it("does not report expected permanent errors (scanned PDF, unreadable file)", () => {
    expect(shouldReport(job(1), new UnrecoverableError("scanned_pdf"))).toBe(false)
  })

  it("reports when the job has no retry settings or is missing", () => {
    expect(shouldReport({ attemptsMade: 1, opts: {} }, new Error("x"))).toBe(true)
    expect(shouldReport(undefined, new Error("x"))).toBe(true)
  })
})
