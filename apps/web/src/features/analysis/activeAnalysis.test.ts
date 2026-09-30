import { beforeEach, describe, expect, it } from "vitest"
import {
  startActiveAnalysis as startActiveAnalysis,
  updateActiveAnalysis as updateActiveAnalysis,
  readActiveAnalysis as readActiveAnalysis,
  clearActiveAnalysis as clearActiveAnalysis,
  resultPath as resultPath,
  handleResponse as handleResponse,
} from "./activeAnalysis"

/** Testler node ortamında; tarayıcının iki yüzeyi elle sağlanıyor. */
function fakeBrowser() {
  const storage = new Map<string, string>()
  const events: string[] = []
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
    dispatchEvent: (e: Event) => {
      events.push(e.type)
      return true
    },
  }
  return { events }
}

describe("activeAnalysis", () => {
  let events: string[]
  beforeEach(() => {
    events = fakeBrowser().events
  })

  it("reads a started analysis and notifies listeners", () => {
    startActiveAnalysis("42")
    expect(readActiveAnalysis()).toMatchObject({ jobId: "42", status: "running" })
    expect(events).toContain("uyarla:aktif-analiz")
  })

  it("records polling responses", () => {
    startActiveAnalysis("42")
    handleResponse("42", { status: "running", stage: "reading_posting" })
    expect(readActiveAnalysis()!.stage).toBe("reading_posting")

    handleResponse("42", { status: "completed", analysisId: "an1", score: 53 })
    expect(readActiveAnalysis()).toMatchObject({ status: "completed", analysisId: "an1", score: 53 })
  })

  it("keeps the reason of a failed analysis", () => {
    startActiveAnalysis("42")
    handleResponse("42", { status: "failed", error: "Bu PDF taranmış bir görüntü." })
    expect(readActiveAnalysis()).toMatchObject({ status: "failed", error: "Bu PDF taranmış bir görüntü." })
  })

  it("ignores an update for another job", () => {
    // Eski sekmedeki yoklama yeni analizin kaydını bozmamalı.
    startActiveAnalysis("43")
    updateActiveAnalysis("42", { status: "completed" })
    expect(readActiveAnalysis()!.status).toBe("running")
  })

  it("no record remains after clearing", () => {
    startActiveAnalysis("42")
    clearActiveAnalysis()
    expect(readActiveAnalysis()).toBeNull()
  })

  it("does not throw when storage is unavailable", () => {
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("engelli")
        },
        setItem: () => {
          throw new Error("engelli")
        },
        removeItem: () => {},
      },
      dispatchEvent: () => true,
    }
    expect(() => startActiveAnalysis("42")).not.toThrow()
    expect(readActiveAnalysis()).toBeNull()
  })

  it("produces the permanent result path", () => {
    expect(resultPath("an 1")).toBe("/analyze?analiz=an%201")
  })
})
