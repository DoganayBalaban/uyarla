import { describe, expect, it } from "vitest"
import { REELS, END_MS, VOICE_CTA, reelFrame, reelSegment } from "@/features/landing/reels/reels"
import { SCENE_LIST } from "@/features/landing/demos/sceneList"

describe("reels (DOG-162)", () => {
  it("has the eleven scene videos of the plan (9 is a screen recording)", () => {
    expect(REELS.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13])
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

  it("speaks the on-screen hook first and ends every video on the same call (DOG-162)", () => {
    for (const r of REELS) {
      // Okunuşu farklı olan açılış cümlesi (sayı yazıyla) hookSpoken'da.
      expect(r.voice[0], `video ${r.n}`).toBe(r.hookSpoken ?? r.hook)
      expect(r.voice.join(" "), `video ${r.n}`).not.toMatch(/\/t\b|com\.tr/)
    }
    // TTS rakamı ve cümle başındaki "CV'nde"yi yanlış okuyordu (Kizagan, 29 Ekim).
    for (const r of REELS) for (const s of r.voice) expect(s, `video ${r.n}`).not.toMatch(/\d|^CV/)
    expect(VOICE_CTA).toBe("Skorunu ücretsiz gör: uyarla nokta com nokta te re.")
  })

  it("stretches the scene to the narration before the end card", () => {
    const seg = { start: 1000, length: 6000 }
    // Anlatım 12 sn: sahne yarı hızda oynar, son karesi anlatımın sonunda.
    expect(reelFrame(seg, 0, 12000)).toEqual({ part: "scene", sceneMs: 1000 })
    expect(reelFrame(seg, 6000, 12000)).toEqual({ part: "scene", sceneMs: 4000 })
    expect(reelFrame(seg, 11999, 12000).sceneMs).toBe(6999)
    expect(reelFrame(seg, 12000, 12000)).toEqual({ part: "end", sceneMs: 6999 })
  })
})
