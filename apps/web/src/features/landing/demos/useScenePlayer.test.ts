import { describe, expect, it } from "vitest"
import { sceneClock, shownMs } from "@/features/landing/demos/useScenePlayer"

describe("scene clock (DOG-160)", () => {
  it("advances only while running and wraps at the loop", () => {
    expect(sceneClock(100, 16, 1000, true)).toBe(116)
    expect(sceneClock(100, 16, 1000, false)).toBe(100)
    expect(sceneClock(990, 16, 1000, true)).toBe(6)
  })

  it("clips the jump after a background tab", () => {
    expect(sceneClock(0, 5000, 10000, true)).toBe(64)
  })

  it("shows the last frame under reduced motion", () => {
    expect(shownMs(300, 1000, true)).toBe(999)
    expect(shownMs(300, 1000, false)).toBe(300)
  })
})
