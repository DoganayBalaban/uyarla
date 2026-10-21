"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, Clock, LoaderCircle, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Stage, StageState } from "@/features/analysis/stageStates"
import { cn } from "@/lib/cn"

export type { Stage as Asama, StageState as AsamaDurumu }

/**
 * Bir işin sıralı aşamalarını gösteren dikey çizelge.
 *
 * 21st.dev'deki "Processing Timeline" bileşeninden uyarlandı (Motiq,
 * Mahammad Rustamov, MIT lisansı — https://21st.dev/@rmahammad/components/processing-timeline).
 * Özgün bileşen yeniden deneme/atlama/iptal, günlükler ve yatay yerleşim de
 * içeriyor; burada yalnızca gerçekten kullandığımız kısım var: aşama
 * işaretçisi (durumu şekille de anlatıyor, yalnızca renkle değil), aşamaları
 * bağlayan ray, aktif aşamada nabız ve durum etiketi. Renkler marka
 * token'larından.
 *
 * İlerleme uydurulmuyor: aşama durumu sunucudan geliyor; çubuk yalnızca biten
 * aşama sayısını gösteriyor (DOG-146), tahmini süre ya da yüzde yok.
 */


const STATE_STYLE: Record<StageState, { label: string; textClass: string; bgClass: string }> = {
  pending: { label: "Sırada", textClass: "text-muted-foreground", bgClass: "bg-card border-border" },
  active: { label: "Çalışıyor", textClass: "text-brand-blue dark:text-brand-blue-light", bgClass: "bg-brand-blue/10 border-brand-blue/50" },
  done: { label: "Tamam", textClass: "text-brand-green dark:text-[#4ade80]", bgClass: "bg-brand-green/10 border-brand-green/50" },
  error: { label: "Olmadı", textClass: "text-brand-red dark:text-[#f87171]", bgClass: "bg-brand-red/10 border-brand-red/50" },
}

function StateIcon({ state, className }: { state: StageState; className?: string }) {
  const p = { className: cn("size-3.5", className), strokeWidth: 2.4, "aria-hidden": true } as const
  if (state === "done") return <Check {...p} />
  if (state === "error") return <TriangleAlert {...p} />
  if (state === "active") return <LoaderCircle {...p} className={cn(p.className, "motion-safe:animate-spin")} />
  return <Clock {...p} />
}

function StepMarker({ state, reducedMotion }: { state: StageState; reducedMotion: boolean }) {
  const d = STATE_STYLE[state]
  return (
    <span
      aria-hidden
      className={cn("relative grid size-8 shrink-0 place-items-center rounded-full border-2", d.bgClass, d.textClass)}
    >
      {state === "active" && !reducedMotion && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-current"
          animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <StateIcon state={state} className="size-4" />
    </span>
  )
}

export function StageTimeline({
  heading,
  subtitle,
  stages,
  className,
}: {
  heading: string
  subtitle?: string
  stages: Stage[]
  className?: string
}) {
  const reducedMotion = useReducedMotion() ?? false
  const doneCount = stages.filter((a) => a.status === "done").length

  return (
    <Card className={cn("gap-5 shadow-xs", className)} aria-label={heading} role="region">
      <CardHeader>
        <CardTitle className="text-lg">{heading}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
        <div className="col-span-full mt-3 flex items-center gap-3">
          <Progress value={(doneCount / Math.max(1, stages.length)) * 100} aria-label="Biten aşamalar" className="h-1.5" />
          <Badge variant="secondary" className="shrink-0 tabular-nums">
            {doneCount}/{stages.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
      <ol className="m-0 list-none p-0">
        <AnimatePresence initial={false}>
          {stages.map((a, i) => {
            const d = STATE_STYLE[a.status]
            const last = i === stages.length - 1
            return (
              <motion.li
                key={a.id}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: reducedMotion ? 0 : i * 0.05, ease: [0.2, 0, 0, 1] }}
                className="relative flex gap-3"
                aria-current={a.status === "active" ? "step" : undefined}
              >
                <div className="flex flex-col items-center">
                  <StepMarker state={a.status} reducedMotion={reducedMotion} />
                  {!last && (
                    <span
                      aria-hidden
                      className={cn(
                        "my-1 w-0.5 flex-1 rounded-full transition-colors duration-500",
                        a.status === "done" ? "bg-brand-green/50" : "bg-border",
                      )}
                    />
                  )}
                </div>
                <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <span
                      className={cn(
                        "font-semibold",
                        a.status === "pending" ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {a.title}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        d.bgClass,
                        d.textClass,
                      )}
                    >
                      <StateIcon state={a.status} className="size-3" />
                      {d.label}
                    </span>
                  </div>
                  {a.description && <p className="m-0 mt-0.5 text-sm text-muted-foreground">{a.description}</p>}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
      </CardContent>
    </Card>
  )
}
