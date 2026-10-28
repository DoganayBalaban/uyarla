"use client"

import { useAnimationFrame, useInView, useReducedMotion } from "motion/react"
import { Pause, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { loopMs, type Phase } from "@/features/landing/demos/demoScript"
import s from "@/features/landing/landing.module.css"

/** Bir sonraki saat değeri; sekme arka plandan dönünce gelen sıçrama 64 ms'e kırpılıyor. */
export function sceneClock(clock: number, delta: number, loop: number, running: boolean): number {
  if (!running) return clock
  return (clock + Math.min(delta, 64)) % loop
}

/** Gösterilen an: hareket azaltmada döngünün son karesi. */
export function shownMs(clock: number, loop: number, reduced: boolean): number {
  return reduced ? loop - 1 : clock
}

/**
 * Hareket azaltma tercihi, bileşen bağlandıktan sonra. Sunucu tercihi
 * bilmiyor; ilk çizimde istemci de bilmiyormuş gibi davranmazsa sahne
 * sunucudakinden farklı kare çiziyor ve React ağacı baştan kuruyordu
 * (hidrasyon hatası).
 */
export function useReducedMotionAfterMount(): boolean {
  const reduced = useReducedMotion() ?? false
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted && reduced
}

/**
 * Tanıtım sahnelerinin saati (DOG-160). Yalnız sahne ekrandayken yürüyor;
 * üç sahne aynı anda oynamıyor. Hareket azaltmada son kare duruyor.
 */
export function useScenePlayer(loop: number, paused = false) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const reduced = useReducedMotionAfterMount()
  const [clock, setClock] = useState(0)
  useAnimationFrame((_, delta) => {
    if (inView && !reduced && !paused) setClock((c) => sceneClock(c, delta, loop, true))
  })
  return { ref, ms: shownMs(clock, loop, reduced), reduced }
}

/**
 * Sahne kabı: ekran okuyucuya tek cümle, içerik aria-hidden. Kendiliğinden
 * oynayan içerik durdurulabilmeli (WCAG 2.2.2); hero filmindeki gibi düğme.
 */
export function Scene({
  label,
  phases,
  children,
}: {
  label: string
  phases: readonly Phase[]
  children: (ms: number) => React.ReactNode
}) {
  const [paused, setPaused] = useState(false)
  const { ref, ms, reduced } = useScenePlayer(loopMs(phases), paused)
  return (
    <div ref={ref} role="figure" aria-label={label} className={`${s.mock} ${s.mockWide} relative`}>
      {!reduced && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Sahneyi oynat" : "Sahneyi duraklat"}
          className="absolute top-3 right-3 z-10 grid size-7 place-items-center rounded-full border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>
      )}
      <div aria-hidden="true">{children(ms)}</div>
    </div>
  )
}
