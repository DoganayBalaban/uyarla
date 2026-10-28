import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { REELS } from "@/features/landing/reels/reels"
import { ReelFrame, reelLength } from "@/features/landing/reels/ReelFrame"

describe("ReelFrame (DOG-162)", () => {
  it("shows the hook over the scene, then the end card", () => {
    const reel = REELS.find((r) => r.n === 3)!
    const start = renderToStaticMarkup(<ReelFrame reel={reel} ms={0} />)
    expect(start).toContain("Bu CV bu ilana 28 puan uyuyor.")
    expect(start).not.toContain("Skorunu ücretsiz gör")
    const end = renderToStaticMarkup(<ReelFrame reel={reel} ms={reelLength(reel) - 1} />)
    expect(end).toContain("Skorunu ücretsiz gör")
    // Ziyaretçi doğrudan ana adrese gidiyor; ayrı TikTok yolu kalktı (DOG-162).
    expect(end).toContain("uyarla.com.tr")
    expect(end).not.toContain("uyarla.com.tr/t")
  })

  it("draws every video's first and last frame", () => {
    for (const r of REELS) {
      expect(() => renderToStaticMarkup(<ReelFrame reel={r} ms={0} />), `video ${r.n}`).not.toThrow()
      expect(renderToStaticMarkup(<ReelFrame reel={r} ms={reelLength(r) - 1} />)).toContain("Skorunu ücretsiz gör")
    }
  })
})
