import { describe, expect, it } from "vitest"
import { isAdmin, summarizeFunnel, type FunnelAnalysisRow } from "@/server/funnel"

const row = (overrides: Partial<FunnelAnalysisRow> & { userId: string }): FunnelAnalysisRow => ({
  status: "done",
  durationMs: 3000,
  isAnonymous: true,
  adapted: false,
  downloaded: false,
  ...overrides,
})

describe("summarizeFunnel", () => {
  it("counts each user once per step, in funnel order", () => {
    const f = summarizeFunnel([
      // u1: iki analiz, kayıt oldu, uyarladı, indirdi
      row({ userId: "u1", isAnonymous: false, adapted: true, downloaded: true }),
      row({ userId: "u1", isAnonymous: false }),
      // u2: kayıt oldu, uyarladı, indirmedi
      row({ userId: "u2", isAnonymous: false, adapted: true }),
      // u3: yalnızca analiz
      row({ userId: "u3" }),
    ])

    expect(f.steps.map((s) => [s.key, s.users])).toEqual([
      ["analyzed", 3],
      ["registered", 2],
      ["adapted", 2],
      ["downloaded", 1],
    ])
  })

  it("counts a step only for users who passed the previous steps", () => {
    // Doğrudan yazılmış kayıtlar (test verisi, eski akış) anonim uyarlama
    // içerebiliyor; huni yine de tekdüze azalmalı, oran %100'ü aşmamalı.
    const f = summarizeFunnel([
      row({ userId: "u1", isAnonymous: false, adapted: true, downloaded: true }),
      row({ userId: "u2", isAnonymous: true, adapted: true, downloaded: true }),
    ])
    expect(f.steps.map((s) => s.users)).toEqual([2, 1, 1, 1])
  })

  it("gives each step's conversion from the previous step", () => {
    const f = summarizeFunnel([
      row({ userId: "u1", isAnonymous: false, adapted: true }),
      row({ userId: "u2", isAnonymous: false }),
      row({ userId: "u3" }),
      row({ userId: "u4" }),
    ])
    expect(f.steps.map((s) => s.fromPrevious)).toEqual([null, 0.5, 0.5, 0])
  })

  it("leaves failed analyses out of the funnel but counts them for the error rate", () => {
    const f = summarizeFunnel([
      row({ userId: "u1" }),
      row({ userId: "u2", status: "failed", durationMs: null }),
      row({ userId: "u3", status: "running", durationMs: null }),
    ])
    expect(f.steps[0]!.users).toBe(1)
    expect(f.analyses).toEqual({ total: 3, done: 1, failed: 1, failureRate: 0.5, sample: 0 })
  })

  it("counts finished analyses made with an unedited sample posting (DOG-101)", () => {
    const f = summarizeFunnel([
      row({ userId: "u1", sample: true }),
      row({ userId: "u2", sample: true, status: "failed", durationMs: null }),
      row({ userId: "u3" }),
    ])
    expect(f.analyses.sample).toBe(1)
  })

  it("reports the median duration of finished analyses", () => {
    const f = summarizeFunnel([
      row({ userId: "u1", durationMs: 2000 }),
      row({ userId: "u2", durationMs: 9000 }),
      row({ userId: "u3", durationMs: 3000 }),
    ])
    expect(f.medianDurationMs).toBe(3000)
  })

  it("handles an empty window", () => {
    const f = summarizeFunnel([])
    expect(f.steps.every((s) => s.users === 0)).toBe(true)
    expect(f.analyses.failureRate).toBe(0)
    expect(f.medianDurationMs).toBeNull()
  })
})

describe("isAdmin", () => {
  it("accepts only listed, registered emails, case-insensitively", () => {
    const list = "dogan@ornek.com, Ikinci@Ornek.com"
    expect(isAdmin({ email: "Dogan@ornek.com", isAnonymous: false }, list)).toBe(true)
    expect(isAdmin({ email: "ikinci@ornek.com", isAnonymous: false }, list)).toBe(true)
    expect(isAdmin({ email: "baska@ornek.com", isAnonymous: false }, list)).toBe(false)
  })

  it("rejects anonymous users, missing users and an empty list", () => {
    expect(isAdmin({ email: "dogan@ornek.com", isAnonymous: true }, "dogan@ornek.com")).toBe(false)
    expect(isAdmin(null, "dogan@ornek.com")).toBe(false)
    expect(isAdmin({ email: "dogan@ornek.com", isAnonymous: false }, undefined)).toBe(false)
    expect(isAdmin({ email: "", isAnonymous: false }, " , ")).toBe(false)
  })
})
