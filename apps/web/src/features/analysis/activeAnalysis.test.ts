import { beforeEach, describe, expect, it } from "vitest"
import {
  startActiveAnalysis,
  updateActiveAnalysis,
  readActiveAnalysis,
  clearActiveAnalysis,
  rehydrateActiveAnalysis,
  handleResponse,
  useActiveAnalysisStore,
} from "@/features/analysis/activeAnalysis"

const KEY = "uyarla:active-analysis"
const LEGACY_KEY = "uyarla:aktif-analiz"

/** Testler node ortamında; tarayıcının localStorage yüzeyi elle sağlanıyor. */
function fakeBrowser() {
  const storage = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
  }
  return storage
}

describe("activeAnalysis", () => {
  let storage: Map<string, string>
  beforeEach(() => {
    storage = fakeBrowser()
    useActiveAnalysisStore.setState({ record: null })
    storage.clear()
  })

  it("persists the record under the storage key", () => {
    startActiveAnalysis("42")
    expect(JSON.parse(storage.get(KEY)!)).toMatchObject({ state: { record: { jobId: "42", status: "running" } } })
    expect(storage.has(LEGACY_KEY)).toBe(false)
  })

  it("restores a persisted record", () => {
    storage.set(KEY, JSON.stringify({ state: { record: { jobId: "7", startedAt: 1, status: "running" } }, version: 1 }))
    rehydrateActiveAnalysis()
    expect(readActiveAnalysis()).toEqual({ jobId: "7", startedAt: 1, status: "running" })
  })

  it("restores a record saved before the zustand store", () => {
    // DOG-40 öncesi kayıt sarmalayıcısız, düz nesne olarak yazılıyordu.
    storage.set(KEY, JSON.stringify({ jobId: "8", startedAt: 2, status: "completed", analysisId: "an8", score: 61 }))
    rehydrateActiveAnalysis()
    expect(readActiveAnalysis()).toEqual({ jobId: "8", startedAt: 2, status: "completed", analysisId: "an8", score: 61 })
  })

  it("upgrades a record saved under the legacy key", () => {
    storage.set(
      LEGACY_KEY,
      JSON.stringify({ jobId: "j1", baslangic: 1000, durum: "running", asama: "ilan_okunuyor", goruldu: false }),
    )
    rehydrateActiveAnalysis()
    expect(readActiveAnalysis()).toEqual({
      jobId: "j1",
      startedAt: 1000,
      status: "running",
      stage: "reading_posting",
      seen: false,
    })
    expect(storage.has(LEGACY_KEY)).toBe(false)
  })

  it("upgrades a completed legacy record with score and error fields", () => {
    storage.set(LEGACY_KEY, JSON.stringify({ jobId: "j2", baslangic: 5, durum: "failed", skor: 12, hata: "Olmadı" }))
    rehydrateActiveAnalysis()
    expect(readActiveAnalysis()).toEqual({ jobId: "j2", startedAt: 5, status: "failed", score: 12, error: "Olmadı" })
  })

  it("drops a corrupt record", () => {
    storage.set(LEGACY_KEY, "{bozuk")
    rehydrateActiveAnalysis()
    expect(readActiveAnalysis()).toBeNull()
    expect(storage.has(LEGACY_KEY)).toBe(false)

    storage.set(KEY, JSON.stringify({ state: { record: { status: "running" } }, version: 1 }))
    rehydrateActiveAnalysis()
    expect(readActiveAnalysis()).toBeNull()
  })

  it("notifies subscribers when an analysis starts", () => {
    const seen: Array<string | undefined> = []
    const stop = useActiveAnalysisStore.subscribe((s) => seen.push(s.record?.jobId))
    startActiveAnalysis("42")
    stop()
    expect(seen).toContain("42")
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

  it("keeps working in memory when storage is unavailable", () => {
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
    }
    expect(() => startActiveAnalysis("42")).not.toThrow()
    expect(() => rehydrateActiveAnalysis()).not.toThrow()
    expect(readActiveAnalysis()).toMatchObject({ jobId: "42" })
  })
})
