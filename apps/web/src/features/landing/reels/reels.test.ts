import { describe, expect, it } from "vitest"
import { REELS, END_MS, reelFrame, reelSegment } from "@/features/landing/reels/reels"
import { SCENE_LIST } from "@/features/landing/demos/sceneList"

describe("reels (DOG-162)", () => {
  it("has the eleven scene videos of the plan (9 is a screen recording)", () => {
    expect(REELS.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12])
  })

  it("points every video at an existing scene and phase window", () => {
    for (const r of REELS) {
      const scene = SCENE_LIST.find((x) => x.id === r.scene)
      expect(scene, `video ${r.n}`).toBeDefined()
      const ids = scene!.phases.map((p) => p.id)
      if (r.from) expect(ids, `video ${r.n} from`).toContain(r.from)
      if (r.to) expect(ids, `video ${r.n} to`).toContain(r.to)
    }
  })

  it("keeps hooks short enough to read in the first two seconds", () => {
    for (const r of REELS) expect(r.hook.length, `video ${r.n}`).toBeLessThanOrEqual(80)
  })

  it("plays the scene window, then the end card", () => {
    const phases = [
      { id: "a", ms: 1000 },
      { id: "b", ms: 2000 },
      { id: "c", ms: 3000 },
    ]
    const seg = reelSegment(phases, "b", "c")
    expect(seg).toEqual({ start: 1000, length: 5000 })
    expect(reelFrame(seg, 0)).toEqual({ part: "scene", sceneMs: 1000 })
    expect(reelFrame(seg, 4999)).toEqual({ part: "scene", sceneMs: 5999 })
    expect(reelFrame(seg, 5000)).toEqual({ part: "end", sceneMs: 5999 })
    expect(reelFrame(seg, 5000 + END_MS + 10)).toEqual({ part: "end", sceneMs: 5999 })
    expect(reelSegment(phases)).toEqual({ start: 0, length: 6000 })
  })
})
