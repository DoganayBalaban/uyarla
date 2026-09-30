"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, Clock, LoaderCircle, TriangleAlert } from "lucide-react"
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
 * İlerleme uydurulmuyor: aşama durumu sunucudan geliyor, yüzde gösterilmiyor.
 */


const STATE_STYLE: Record<StageState, { label: string; textClass: string; bgClass: string }> = {
  pending: { label: "Sırada", textClass: "text-gri", bgClass: "bg-kart border-cizgi" },
  active: { label: "Çalışıyor", textClass: "text-mavi dark:text-[#8ea2ff]", bgClass: "bg-mavi/10 border-mavi/50" },
  done: { label: "Tamam", textClass: "text-yesil dark:text-[#4ade80]", bgClass: "bg-yesil/10 border-yesil/50" },
  error: { label: "Olmadı", textClass: "text-kirmizi dark:text-[#f87171]", bgClass: "bg-kirmizi/10 border-kirmizi/50" },
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
    <section
      className={cn("rounded-kart border border-cizgi bg-kart p-5 shadow-sm sm:p-6", className)}
      aria-label={heading}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-lg">{heading}</h2>
          {subtitle && <p className="m-0 mt-1 text-sm text-gri">{subtitle}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-zemin px-2.5 py-1 text-xs font-semibold tabular-nums text-gri">
          {doneCount}/{stages.length}
        </span>
      </header>

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
                        a.status === "done" ? "bg-yesil/50" : "bg-cizgi",
                      )}
                    />
                  )}
                </div>
                <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <span
                      className={cn(
                        "font-semibold",
                        a.status === "pending" ? "text-gri" : "text-metin",
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
                  {a.description && <p className="m-0 mt-0.5 text-sm text-gri">{a.description}</p>}
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
    </section>
  )
}
