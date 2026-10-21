import { describe, expect, it, vi } from "vitest"
import { isStaleChunkError, reloadOnce } from "@/lib/staleChunk"

describe("stale chunk recovery (DOG-140)", () => {
  it("recognises chunk load failures, not other errors", () => {
    const chunk = Object.assign(new Error("Loading chunk 4821 failed."), { name: "ChunkLoadError" })
    expect(isStaleChunkError(chunk)).toBe(true)
    expect(isStaleChunkError(new Error("Loading chunk app/adapt/page-abc failed. (error: https://uyarla.com.tr/_next/…)"))).toBe(true)
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: /_next/static/x.js"))).toBe(true)
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
  })

  it("reloads once per minute, never in a loop", () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    const reload = vi.fn()
    let now = 1_000_000
    expect(reloadOnce({ storage, reload, now: () => now })).toBe(true)
    now += 5_000
    expect(reloadOnce({ storage, reload, now: () => now })).toBe(false)
    now += 61_000
    expect(reloadOnce({ storage, reload, now: () => now })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it("does not reload without storage, since it could not stop a loop", () => {
    const reload = vi.fn()
    expect(reloadOnce({ storage: null, reload, now: () => 0 })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
