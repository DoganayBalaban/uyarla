import { describe, expect, it } from "vitest"
import { workerOptions } from "./workerOptions.js"

describe("workerOptions", () => {
  it("holds the job lock long enough that a briefly blocked event loop does not start the job twice", () => {
    // DOG-65: varsayılan 30 sn; yük altında yenilenemeyip iş ikinci kez işlendi.
    const options = workerOptions({} as never, 2)
    expect(options.lockDuration).toBeGreaterThanOrEqual(120_000)
    expect(options.concurrency).toBe(2)
  })
})
