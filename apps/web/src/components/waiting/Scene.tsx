"use client"

import { motion, useReducedMotion } from "motion/react"
import { Check, GitCompareArrows, type LucideIcon } from "lucide-react"
import type { SheetState } from "@/components/waiting/WaitingFrame"
import { cn } from "@/lib/cn"

/**
 * Bekleme sahnelerinin küçük parçaları (K-104): iki taraf arasındaki bağlar
 * ve sahnedeki küçük kartlar (ilan, soru). Çerçeve ve kâğıt WaitingFrame'de.
 */

/** Satırdan satıra kıvrılan bağlar; karşılaştırmada akıyor. */
const PATHS = ["M0,60 C50,60 50,110 100,110", "M0,120 C50,120 50,55 100,55", "M0,175 C50,175 50,165 100,165"]

export function Threads({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div className="relative h-full min-h-24" aria-hidden>
      <svg viewBox="0 0 100 220" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        {PATHS.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
            className={cn("transition-colors duration-500", active ? "stroke-primary" : "stroke-border")}
            initial={false}
            animate={active && !reducedMotion ? { strokeDashoffset: [0, -16] } : { strokeDashoffset: 0 }}
            transition={active && !reducedMotion ? { duration: 0.9 + i * 0.25, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={cn(
            "relative grid size-9 place-items-center rounded-full border bg-background shadow-xs transition-colors duration-500 sm:size-11",
            active ? "border-primary/60 text-primary" : "text-muted-foreground",
          )}
        >
          {active && !reducedMotion && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.5], opacity: [0.45, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <GitCompareArrows className="size-4 sm:size-5" />
        </span>
      </div>
    </div>
  )
}

/**
 * Sahnedeki küçük kart: seçilen ilan, yazılan soru. Etkinken çerçevesi
 * yanıyor ve yazımda imleç yanıp sönüyor; bitince köşede onay.
 */
export function SceneCard({
  icon: Icon,
  title,
  meta,
  state,
  writing = false,
}: {
  icon: LucideIcon
  title: string
  meta?: string | null
  state: SheetState
  writing?: boolean
}) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 shadow-xs transition-all duration-500",
        state === "active" && "border-primary/50 shadow-md ring-4 ring-primary/10",
        state === "idle" && "opacity-55",
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-500",
          state === "done" ? "bg-brand-green/10 text-brand-green dark:text-[#4ade80]" : "bg-primary/10 text-primary",
        )}
        aria-hidden
      >
        {state === "done" ? <Check className="size-3.5" strokeWidth={2.6} /> : <Icon className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {title}
          {state === "active" && writing && !reducedMotion && (
            <motion.span
              aria-hidden
              className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.15em] bg-primary"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </span>
        {meta && <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>}
      </span>
    </div>
  )
}
