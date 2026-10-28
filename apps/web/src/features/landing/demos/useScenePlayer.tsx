"use client"

import { useAnimationFrame, useInView, useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
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
 * Tanıtım sahnelerinin saati (DOG-160). Yalnız sahne ekrandayken yürüyor;
 * üç sahne aynı anda oynamıyor. Hareket azaltmada son kare duruyor.
 */
export function useScenePlayer(loop: number) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const reduced = useReducedMotion() ?? false
  const [clock, setClock] = useState(0)
  useAnimationFrame((_, delta) => {
    if (inView && !reduced) setClock((c) => sceneClock(c, delta, loop, true))
  })
  return { ref, ms: shownMs(clock, loop, reduced) }
}

/** Sahne kabı: ekran okuyucuya tek cümle, içerik aria-hidden. */
export function Scene({
  label,
  phases,
  children,
}: {
  label: string
  phases: readonly Phase[]
  children: (ms: number) => React.ReactNode
}) {
  const { ref, ms } = useScenePlayer(loopMs(phases))
  return (
    <div ref={ref} role="figure" aria-label={label} className={`${s.mock} ${s.mockWide}`}>
      <div aria-hidden="true">{children(ms)}</div>
    </div>
  )
}
