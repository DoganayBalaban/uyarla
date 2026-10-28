"use client"

import { MotionGlobalConfig, useAnimationFrame } from "motion/react"
import { useEffect, useState } from "react"
import { REELS } from "@/features/landing/reels/reels"
import { ReelFrame, reelLength } from "@/features/landing/reels/ReelFrame"

declare global {
  interface Window {
    /** Kayıt betiği için: videonun uzunluğu ve anı seçme (DOG-162). */
    __reel?: { length: number; setMs: (ms: number) => Promise<void> }
  }
}

/**
 * Dikey videolar (DOG-162). Normalde oynatıcı: video seç, oynat, kaydır.
 * `?n=3&capture=1`: yalnızca kare, köşede; animasyonlar kapalı ve an
 * `window.__reel.setMs` ile seçiliyor; kare kare ekran görüntüsü için.
 */
export function ReelShowcase({ n, capture }: { n: number | null; capture: boolean }) {
  const [current, setCurrent] = useState(n ?? REELS[0]!.n)
  const [ms, setMs] = useState(0)
  const [playing, setPlaying] = useState(!capture)
  const reel = REELS.find((r) => r.n === current) ?? REELS[0]!
  const length = reelLength(reel)

  useAnimationFrame((_, delta) => {
    if (playing && !capture) setMs((m) => (m + Math.min(delta, 64)) % length)
  })

  useEffect(() => {
    if (!capture) return
    MotionGlobalConfig.skipAnimations = true
    document.documentElement.dataset.capture = "true"
    window.__reel = {
      length,
      setMs: (next) =>
        new Promise((resolve) => {
          setMs(next)
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        }),
    }
  }, [capture, length])

  if (capture) return <ReelFrame reel={reel} ms={ms} />

  return (
    <main className="mx-auto flex max-w-5xl flex-wrap gap-8 px-4 py-10">
      <div className="flex w-64 flex-col gap-2">
        {REELS.map((r) => (
          <button
            key={r.n}
            type="button"
            onClick={() => {
              setCurrent(r.n)
              setMs(0)
            }}
            className={`rounded border px-3 py-2 text-left text-sm ${r.n === current ? "bg-muted font-semibold" : ""}`}
          >
            {r.n}. {r.hook}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border shadow-sm">
          <ReelFrame reel={reel} ms={ms} />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Duraklat" : "Oynat"}
          </button>
          <input type="range" min={0} max={length - 1} value={ms} onChange={(e) => setMs(Number(e.target.value))} className="flex-1" aria-label="An" />
          <span className="text-xs tabular-nums text-muted-foreground">{(length / 1000).toFixed(1)} sn</span>
        </div>
      </div>
    </main>
  )
}
