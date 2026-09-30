"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/cn"
import { scoreStatus } from "@/lib/scoreStatus"

// Eşikler src/lib/scoreStatus.ts'te; mevcut içe aktarmalar bozulmasın diye buradan da açık.
export { scoreStatus as skorDurumu }

/**
 * Dairesel skor göstergesi. 21st.dev'deki radyal ilerleme göstergelerinin
 * (ör. https://21st.dev/@sean0205/components/progress/radial) yaygın
 * deseni: SVG halka, dolum animasyonu, ortada değer.
 */
export function ScoreRing({ score, size = 132, className }: { score: number; size?: number; className?: string }) {
  const reducedMotion = useReducedMotion() ?? false
  const d = scoreStatus(score)
  const r = 44
  const circumference = 2 * Math.PI * r
  const filled = (circumference * Math.max(0, Math.min(100, score))) / 100

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`ATS uyum skoru ${score}, ${d.label}`}
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
          className={d.strokeClass}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reducedMotion ? circumference - filled : circumference }}
          animate={{ strokeDashoffset: circumference - filled }}
          transition={{ duration: reducedMotion ? 0 : 1.1, ease: [0.2, 0, 0, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className={cn("font-baslik font-extrabold leading-none tracking-tight", d.textClass)} style={{ fontSize: size * 0.3 }}>
          {score}
        </span>
        <span className={cn("mt-1 text-[11px] font-bold uppercase tracking-wide", d.textClass)}>{d.label.replace(" uyum", "")}</span>
      </div>
    </div>
  )
}
