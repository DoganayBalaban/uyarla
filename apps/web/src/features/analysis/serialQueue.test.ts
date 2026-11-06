import { describe, expect, it } from "vitest"
import { createSerialQueue } from "@/features/analysis/serialQueue"

describe("createSerialQueue", () => {
  it("starts a task only after the previous one finished", async () => {
    const run = createSerialQueue()
    const events: string[] = []
    let release!: () => void
    const first = run(async () => {
      events.push("first:start")
      await new Promise<void>((resolve) => (release = resolve))
      events.push("first:end")
    })
    const second = run(async () => {
      events.push("second:start")
      return 2
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(["first:start"])
    release()
    await first
    expect(await second).toBe(2)
    expect(events).toEqual(["first:start", "first:end", "second:start"])
  })

  it("keeps going after a failed task and still reports the failure", async () => {
    const run = createSerialQueue()
    const failed = run(async () => {
      throw new Error("patladı")
    })
    const next = run(async () => "tamam")
    await expect(failed).rejects.toThrow("patladı")
    await expect(next).resolves.toBe("tamam")
  })
})
