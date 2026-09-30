"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/cn"
import { skorDurumu } from "@/lib/skor"

// Eşikler lib/skor.ts'te; mevcut içe aktarmalar bozulmasın diye buradan da açık.
export { skorDurumu }

/**
 * Dairesel skor göstergesi. 21st.dev'deki radyal ilerleme göstergelerinin
 * (ör. https://21st.dev/@sean0205/components/progress/radial) yaygın
 * deseni: SVG halka, dolum animasyonu, ortada değer.
 */
export function SkorHalkasi({ skor, boyut = 132, className }: { skor: number; boyut?: number; className?: string }) {
  const azHareket = useReducedMotion() ?? false
  const d = skorDurumu(skor)
  const r = 44
  const cevre = 2 * Math.PI * r
  const dolu = (cevre * Math.max(0, Math.min(100, skor))) / 100

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: boyut, height: boyut }}
      role="img"
      aria-label={`ATS uyum skoru ${skor}, ${d.etiket}`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-cizgi" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={d.iz}
          strokeDasharray={cevre}
          initial={{ strokeDashoffset: azHareket ? cevre - dolu : cevre }}
          animate={{ strokeDashoffset: cevre - dolu }}
          transition={{ duration: azHareket ? 0 : 1.1, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className={cn("font-baslik font-extrabold leading-none tracking-tight", d.renk)} style={{ fontSize: boyut * 0.3 }}>
          {skor}
        </span>
        <span className={cn("mt-1 text-[11px] font-bold uppercase tracking-wide", d.renk)}>{d.etiket.replace(" uyum", "")}</span>
      </div>
    </div>
  )
}
