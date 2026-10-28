import { describe, expect, it } from "vitest"
import {
  HERO_LOOP_MS,
  HERO_PHASES,
  heroPhaseAt,
  typedSlice,
  DEMO_BULLETS,
  DEMO_BASE_SCORE,
  demoScore,
  decidedCount,
  downloadUnlocked,
  span,
  ease,
  phaseAt,
  loopMs,
  phaseReached,
} from "@/features/landing/demos/demoScript"

describe("heroPhaseAt", () => {
  it("starts at the first phase with zero progress", () => {
    expect(heroPhaseAt(0)).toEqual({ phase: HERO_PHASES[0]!.id, progress: 0 })
  })

  it("walks through every phase in order", () => {
    let start = 0
    for (const p of HERO_PHASES) {
      expect(heroPhaseAt(start + p.ms / 2).phase).toBe(p.id)
      start += p.ms
    }
    expect(start).toBe(HERO_LOOP_MS)
  })

  it("loops after the last phase", () => {
    expect(heroPhaseAt(HERO_LOOP_MS + 1)).toEqual(heroPhaseAt(1))
  })
})

describe("typedSlice", () => {
  it("types the text by progress, clamped", () => {
    expect(typedSlice("abcd", 0)).toBe("")
    expect(typedSlice("abcd", 0.5)).toBe("ab")
    expect(typedSlice("abcd", 2)).toBe("abcd")
  })
})

describe("demo decisions", () => {
  const none = {}
  const allNew = Object.fromEntries(DEMO_BULLETS.map((b) => [b.id, "new" as const]))
  const allOld = Object.fromEntries(DEMO_BULLETS.map((b) => [b.id, "old" as const]))

  it("scores 28 with nothing accepted and 41 with everything accepted", () => {
    expect(demoScore(none)).toBe(DEMO_BASE_SCORE)
    expect(DEMO_BASE_SCORE).toBe(28)
    expect(demoScore(allNew)).toBe(41)
    expect(demoScore(allOld)).toBe(28)
  })

  it("counts decisions", () => {
    expect(decidedCount(none)).toBe(0)
    expect(decidedCount({ [DEMO_BULLETS[0]!.id]: "old" })).toBe(1)
    expect(decidedCount(allNew)).toBe(DEMO_BULLETS.length)
  })

  it("locks download until every flagged bullet is decided", () => {
    const flagged = DEMO_BULLETS.filter((b) => b.flag)
    expect(flagged.length).toBeGreaterThan(0)
    expect(downloadUnlocked(none)).toBe(false)
    // Yalnız işaretsizlere karar vermek yetmez.
    const onlyClean = Object.fromEntries(DEMO_BULLETS.filter((b) => !b.flag).map((b) => [b.id, "new" as const]))
    expect(downloadUnlocked(onlyClean)).toBe(false)
    expect(downloadUnlocked(Object.fromEntries(flagged.map((b) => [b.id, "old" as const])))).toBe(true)
  })
})

describe("span / ease", () => {
  it("maps a sub-range to 0–1 and eases at the ends", () => {
    expect(span(0.1, 0.2, 0.6)).toBe(0)
    expect(span(0.4, 0.2, 0.6)).toBeCloseTo(0.5)
    expect(span(0.9, 0.2, 0.6)).toBe(1)
    expect(ease(0)).toBe(0)
    expect(ease(0.5)).toBe(0.5)
    expect(ease(1)).toBe(1)
  })
})

describe("phaseAt, loopMs, phaseReached", () => {
  const P = [
    { id: "a", ms: 100 },
    { id: "b", ms: 300 },
  ] as const

  it("finds the phase and its progress, looping", () => {
    expect(loopMs(P)).toBe(400)
    expect(phaseAt(P, 0)).toEqual({ phase: "a", progress: 0 })
    expect(phaseAt(P, 250)).toEqual({ phase: "b", progress: 0.5 })
    expect(phaseAt(P, 399).phase).toBe("b")
    expect(phaseAt(P, 400)).toEqual({ phase: "a", progress: 0 })
    expect(phaseAt(P, -100)).toEqual({ phase: "b", progress: 2 / 3 })
  })

  it("tells whether a phase has been reached", () => {
    expect(phaseReached(P, "b", "a")).toBe(true)
    expect(phaseReached(P, "a", "b")).toBe(false)
    expect(phaseReached(P, "b", "b")).toBe(true)
  })

  it("keeps the hero helper identical", () => {
    for (const ms of [0, 1799, 1800, 5000, HERO_LOOP_MS - 1, HERO_LOOP_MS + 7]) {
      expect(heroPhaseAt(ms)).toEqual(phaseAt(HERO_PHASES, ms))
    }
  })
})
