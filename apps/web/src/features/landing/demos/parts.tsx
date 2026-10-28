"use client"

import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react"
import { useEffect } from "react"
import { scoreStatus } from "@/lib/scoreStatus"
import type { Decision, Segment } from "@/features/landing/demos/demoScript"
import { useReducedMotionAfterMount } from "@/features/landing/demos/useScenePlayer"

/**
 * Demoların ortak parçaları: skor halkası ve madde metni. Ürün ekranlarındaki
 * karşılıklarının (ScoreRing, DiffText) görünüşünü taşıyorlar ama onlara
 * bağlı değiller; demo değiştiğinde ürün kırılmasın diye.
 */

const R = 44
const C = 2 * Math.PI * R

/**
 * Skor halkası. `animated` açıkken skor değiştiğinde sayı ve yay yumuşakça
 * yeni değere akar; kapalıyken (hero filmi kendi saatini yürütüyor) verilen
 * değer olduğu gibi çizilir.
 */
export function DemoRing({
  score,
  size = 72,
  animated = true,
  muted = false,
  label,
}: {
  score: number
  size?: number
  animated?: boolean
  muted?: boolean
  label?: string
}) {
  const reduced = useReducedMotionAfterMount()
  const value = useMotionValue(score)
  const rounded = useTransform(value, (v) => Math.round(v))
  const dash = useTransform(value, (v) => `${(C * Math.max(0, Math.min(100, v))) / 100} ${C}`)

  useEffect(() => {
    if (!animated || reduced) {
      value.set(score)
      return
    }
    const controls = animate(value, score, { duration: 0.9, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [score, animated, reduced, value])

  const status = scoreStatus(score)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
          <circle cx="50" cy="50" r={R} fill="none" className="stroke-border" strokeWidth="8" />
          <motion.circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            className={muted ? "stroke-muted-foreground/40" : status.strokeClass}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ strokeDasharray: dash }}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <motion.span
            className={`font-heading font-extrabold tabular-nums ${muted ? "text-muted-foreground" : status.textClass}`}
            style={{ fontSize: size * 0.3 }}
          >
            {rounded}
          </motion.span>
        </div>
      </div>
      <span className={`text-[0.6875rem] font-bold uppercase tracking-wide ${muted ? "text-muted-foreground" : status.textClass}`}>
        {label ?? status.label}
      </span>
    </div>
  )
}

/**
 * Madde metni. Kararsızken fark (çıkan üstü çizili, eklenen yeşil), kararla
 * birlikte seçilen hâl; giden parça söner, gelen belirir.
 */
export function BulletText({ segments, decision }: { segments: Segment[]; decision?: Decision }) {
  return (
    <p className="leading-relaxed">
      <AnimatePresence initial={false}>
        {segments.map((seg, i) => {
          if ((decision === "new" && seg.kind === "del") || (decision === "old" && seg.kind === "add")) return null
          const className =
            seg.kind === "add" && decision !== "old"
              ? "rounded bg-brand-green/15 px-0.5"
              : seg.kind === "del" && !decision
                ? "text-muted-foreground line-through decoration-muted-foreground/70"
                : undefined
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={className}
            >
              {seg.text}
            </motion.span>
          )
        })}
      </AnimatePresence>
    </p>
  )
}

/** Yeni hâli / Eski hâli seçimi; seçili olanın zemini kayarak yer değiştirir. */
export function DecisionToggle({
  id,
  value,
  onChange,
}: {
  id: string
  value?: Decision
  onChange: (d: Decision) => void
}) {
  const options: { d: Decision; text: string }[] = [
    { d: "new", text: "Yeni hâli" },
    { d: "old", text: "Eski hâli" },
  ]
  return (
    <div role="radiogroup" aria-label="Hangi hâli kullanılsın" className="relative flex rounded-[10px] bg-background p-1 text-sm">
      {options.map((o) => {
        const active = value === o.d
        return (
          <button
            key={o.d}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.d)}
            className={`relative z-0 cursor-pointer rounded-lg px-3 py-1 font-semibold transition-colors ${
              active ? (o.d === "new" ? "text-brand-blue" : "text-foreground") : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`toggle-${id}`}
                className="absolute inset-0 -z-10 rounded-lg bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            {active && o.d === "new" && "✓ "}
            {o.text}
          </button>
        )
      })}
    </div>
  )
}
