"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, ChevronRight, Lightbulb, Timer, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { elapsedLabel } from "@/components/waiting/text"
import { deriveStageStates, type Stage } from "@/features/analysis/stageStates"
import { cn } from "@/lib/cn"

/**
 * Analiz ve uyarlamanın bekleme ekranlarının ortak çerçevesi: üstte süren
 * aşamanın adı ve geçen süre, ortada sahne (her ekran kendisi çiziyor),
 * altta aşama çubuğu ve dönen kısa bilgiler.
 *
 * İlerleme uydurulmuyor (DOG-146 kuralı sürüyor): aşama sunucudan geliyor,
 * sayaç yalnızca geçen süre. Bilgiler ürünün gerçek kuralları; istatistik yok.
 */

export interface WaitingStep {
  id: string
  /** Aşama çubuğundaki kısa ad. */
  short: string
  title: string
  description: string
}

export function WaitingFrame({
  eyebrow,
  steps,
  activeId,
  startedAt,
  facts,
  footnote,
  children,
}: {
  eyebrow: string
  steps: WaitingStep[]
  activeId: string | null
  /** Başlangıç anı (ms); bilinmiyorsa sayaç ekran açıldığında başlıyor. */
  startedAt?: number | null
  facts: string[]
  footnote?: string
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion() ?? false
  // Worker "completed" dedi ama kayıt henüz bitmedi: ilk adıma dönmesin, son adım sürüyor.
  const current = activeId === "completed" ? steps[steps.length - 1]!.id : activeId
  const states = deriveStageStates(steps, current)
  const activeIndex = Math.max(0, states.findIndex((s) => s.status === "active"))
  const active = steps[activeIndex]!
  const elapsed = useElapsed(startedAt ?? null)

  return (
    <div>
      <Card className="gap-0 overflow-hidden py-0 shadow-xs">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0" role="status" aria-live="polite">
            <p className="m-0 text-xs font-semibold tracking-wide text-primary uppercase">
              {eyebrow}
              <span className="sr-only">
                , adım {activeIndex + 1} / {steps.length}
              </span>
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              >
                <h1 className="m-0 mt-1 text-xl font-semibold tracking-tight">{active.title}</h1>
                <p className="m-0 mt-1 text-sm text-muted-foreground">{active.description}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          {elapsed && (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground tabular-nums"
              aria-label={`Geçen süre ${elapsed}`}
            >
              <Timer className="size-3.5" aria-hidden />
              {elapsed}
            </span>
          )}
        </div>

        <div className="border-y bg-muted/40 px-4 py-6 sm:px-6">{children}</div>

        <StepRail states={states} steps={steps} reducedMotion={reducedMotion} />
        <FactTicker facts={facts} reducedMotion={reducedMotion} />
      </Card>
      {footnote && <p className="m-0 mt-3 text-center text-xs text-muted-foreground">{footnote}</p>}
    </div>
  )
}

function StepRail({ states, steps, reducedMotion }: { states: Stage[]; steps: WaitingStep[]; reducedMotion: boolean }) {
  return (
    <ol className="m-0 flex list-none items-center gap-2 px-5 py-4 sm:px-6" aria-label="Aşamalar">
      {states.map((s, i) => (
        <Fragment key={s.id}>
          <li className="flex shrink-0 items-center gap-2" aria-current={s.status === "active" ? "step" : undefined}>
            <span
              className={cn(
                "relative grid size-6 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors",
                s.status === "done" && "border-brand-green/50 bg-brand-green/10 text-brand-green dark:text-[#4ade80]",
                s.status === "active" && "border-primary bg-primary text-primary-foreground",
                s.status === "pending" && "bg-background text-muted-foreground",
              )}
            >
              {s.status === "active" && !reducedMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {s.status === "done" ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-xs font-medium", s.status === "pending" ? "text-muted-foreground" : "text-foreground")}>
              {steps[i]!.short}
              <span className="sr-only">
                {s.status === "done" ? " (tamam)" : s.status === "active" ? " (sürüyor)" : " (sırada)"}
              </span>
            </span>
          </li>
          {i < states.length - 1 && (
            <li role="presentation" className="h-0.5 min-w-4 flex-1 overflow-hidden rounded-full bg-border">
              <motion.span
                className="block h-full bg-brand-green/60"
                initial={false}
                animate={{ width: s.status === "done" ? "100%" : "0%" }}
                transition={{ duration: reducedMotion ? 0 : 0.6, ease: [0.2, 0, 0, 1] }}
              />
            </li>
          )}
        </Fragment>
      ))}
    </ol>
  )
}

const FACT_INTERVAL_MS = 8000

function FactTicker({ facts, reducedMotion }: { facts: string[]; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (facts.length < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % facts.length), FACT_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [facts.length, index])
  if (facts.length === 0) return null

  return (
    <div className="flex items-start gap-3 border-t px-5 py-4 sm:px-6">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
      <div className="min-h-10 min-w-0 flex-1">
        <p className="m-0 text-xs font-semibold text-muted-foreground">Bu arada</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={reducedMotion ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, x: -8 }}
            transition={{ duration: 0.25 }}
            className="m-0 mt-0.5 text-sm"
          >
            {facts[index]}
          </motion.p>
        </AnimatePresence>
      </div>
      {facts.length > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 size-8 shrink-0 text-muted-foreground"
          onClick={() => setIndex((i) => (i + 1) % facts.length)}
          aria-label="Sonraki bilgi"
        >
          <ChevronRight aria-hidden />
        </Button>
      )}
    </div>
  )
}

/** Geçen süre etiketi; sunucu çiziminde ve ilk çizimde null (hydration aynı kalsın). */
function useElapsed(startedAt: number | null): string | null {
  const origin = useRef<number | null>(startedAt)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (origin.current === null) origin.current = Date.now()
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (startedAt !== null) origin.current = startedAt
  }, [startedAt])
  return now === null || origin.current === null ? null : elapsedLabel(now - origin.current)
}

/**
 * Satırlar arasında dolaşan imleç: etkinken her `intervalMs`'de bir sonraki
 * satır; etkin değilken ya da hareket azaltıldığında -1.
 */
export function useCycle(count: number, enabled: boolean, intervalMs = 650): number {
  const reducedMotion = useReducedMotion() ?? false
  const [index, setIndex] = useState(-1)
  const on = enabled && !reducedMotion && count > 0
  useEffect(() => {
    if (!on) {
      setIndex(-1)
      return
    }
    setIndex(0)
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs)
    return () => window.clearInterval(timer)
  }, [on, count, intervalMs])
  return index
}

/** Kâğıt üzerindeki iskelet satırların genişlikleri (%); sabit, rastgele değil. */
const SKELETON = [92, 76, 84, 58, 88, 70, 64, 82, 52, 74, 66]

export type SheetState = "idle" | "active" | "done"
export type SheetMode = "read" | "write" | "verify"

/**
 * Sahnedeki belge: CV ya da ilan. Gerçek satırlar varsa onlar (kullanıcının
 * kendi metni), yoksa iskelet çizgiler. Etkin belgede tarama ışığı ya da
 * yazım imleci dolaşıyor; biten belgenin köşesinde onay.
 */
export function PaperSheet({
  label,
  icon: Icon,
  title,
  lines,
  state,
  mode = "read",
  doneLabel = "okundu",
  className,
}: {
  label: string
  icon: LucideIcon
  title?: string | null
  lines?: string[] | null
  state: SheetState
  mode?: SheetMode
  doneLabel?: string
  className?: string
}) {
  const reducedMotion = useReducedMotion() ?? false
  const real = lines && lines.length > 0 ? lines : null
  const count = real ? real.length : SKELETON.length
  const cursor = useCycle(count, state === "active", mode === "write" ? 1100 : 600)
  const tone = mode === "verify" ? "green" : "primary"

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card p-3 shadow-xs transition-all duration-500 sm:p-4",
        state === "active" &&
          (tone === "green"
            ? "border-brand-green/50 shadow-md ring-4 ring-brand-green/10"
            : "border-primary/50 shadow-md ring-4 ring-primary/10"),
        state === "idle" && "opacity-55",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        <span className="truncate">{label}</span>
        <AnimatePresence>
          {state === "done" && (
            <motion.span
              initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-green normal-case dark:text-[#4ade80]"
            >
              <Check className="size-3" strokeWidth={2.6} aria-hidden />
              {doneLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {title && <p className="m-0 mt-2 truncate text-xs font-semibold text-foreground">{title}</p>}

      <div className={cn("mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden", !title && "mt-3")}>
        {real
          ? real.map((line, i) => (
              <p
                key={`${i}-${line}`}
                className={cn(
                  "m-0 -mx-1 truncate rounded px-1 text-[10px] leading-[1.5] text-muted-foreground transition-colors duration-300 sm:text-[11px]",
                  cursor === i && (tone === "green" ? "bg-brand-green/10 text-foreground" : "bg-primary/10 text-foreground"),
                )}
              >
                {line}
                {cursor === i && mode === "write" && (
                  <motion.span
                    aria-hidden
                    className="ml-0.5 inline-block h-[1em] w-px translate-y-[0.15em] bg-primary"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                )}
              </p>
            ))
          : null}
        {/* Belgenin devamı: gerçek satırlardan sonra soluk iskelet; taşan kısım kesiliyor. */}
        {real &&
          SKELETON.map((width, i) => (
            <span key={`kuyruk-${i}`} aria-hidden className="block h-1.5 rounded-full bg-muted-foreground/10" style={{ width: `${width}%` }} />
          ))}
        {!real &&
          SKELETON.map((width, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "block h-1.5 rounded-full bg-muted-foreground/15 transition-colors duration-300",
                  cursor === i && (tone === "green" ? "bg-brand-green/50" : "bg-primary/50"),
                )}
                style={{ width: `${width}%` }}
              />
            ))}
      </div>

      {state === "active" && mode !== "write" && !reducedMotion && (
        <motion.div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 h-14 bg-gradient-to-b from-transparent to-transparent",
            tone === "green" ? "via-brand-green/15" : "via-primary/15",
          )}
          initial={{ top: "-20%" }}
          animate={{ top: ["-20%", "100%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className={cn("absolute inset-x-0 top-1/2 h-px", tone === "green" ? "bg-brand-green/60" : "bg-primary/60")} />
        </motion.div>
      )}
    </div>
  )
}
