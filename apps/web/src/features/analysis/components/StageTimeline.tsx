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


const DURUM: Record<StageState, { etiket: string; renk: string; zemin: string }> = {
  pending: { etiket: "Sırada", renk: "text-gri", zemin: "bg-kart border-cizgi" },
  active: { etiket: "Çalışıyor", renk: "text-mavi dark:text-[#8ea2ff]", zemin: "bg-mavi/10 border-mavi/50" },
  done: { etiket: "Tamam", renk: "text-yesil dark:text-[#4ade80]", zemin: "bg-yesil/10 border-yesil/50" },
  error: { etiket: "Olmadı", renk: "text-kirmizi dark:text-[#f87171]", zemin: "bg-kirmizi/10 border-kirmizi/50" },
}

function DurumIkonu({ durum, className }: { durum: StageState; className?: string }) {
  const p = { className: cn("size-3.5", className), strokeWidth: 2.4, "aria-hidden": true } as const
  if (durum === "done") return <Check {...p} />
  if (durum === "error") return <TriangleAlert {...p} />
  if (durum === "active") return <LoaderCircle {...p} className={cn(p.className, "motion-safe:animate-spin")} />
  return <Clock {...p} />
}

function Isaretci({ durum, azHareket }: { durum: StageState; azHareket: boolean }) {
  const d = DURUM[durum]
  return (
    <span
      aria-hidden
      className={cn("relative grid size-8 shrink-0 place-items-center rounded-full border-2", d.zemin, d.renk)}
    >
      {durum === "active" && !azHareket && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-current"
          animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <DurumIkonu durum={durum} className="size-4" />
    </span>
  )
}

export function AsamaCizelgesi({
  baslik,
  altBaslik,
  asamalar,
  className,
}: {
  baslik: string
  altBaslik?: string
  asamalar: Stage[]
  className?: string
}) {
  const azHareket = useReducedMotion() ?? false
  const bitenSayisi = asamalar.filter((a) => a.status === "done").length

  return (
    <section
      className={cn("rounded-kart border border-cizgi bg-kart p-5 shadow-sm sm:p-6", className)}
      aria-label={baslik}
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-lg">{baslik}</h2>
          {altBaslik && <p className="m-0 mt-1 text-sm text-gri">{altBaslik}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-zemin px-2.5 py-1 text-xs font-semibold tabular-nums text-gri">
          {bitenSayisi}/{asamalar.length}
        </span>
      </header>

      <ol className="m-0 list-none p-0">
        <AnimatePresence initial={false}>
          {asamalar.map((a, i) => {
            const d = DURUM[a.status]
            const son = i === asamalar.length - 1
            return (
              <motion.li
                key={a.id}
                initial={azHareket ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: azHareket ? 0 : i * 0.05, ease: [0.2, 0, 0, 1] }}
                className="relative flex gap-3"
                aria-current={a.status === "active" ? "step" : undefined}
              >
                <div className="flex flex-col items-center">
                  <Isaretci durum={a.status} azHareket={azHareket} />
                  {!son && (
                    <span
                      aria-hidden
                      className={cn(
                        "my-1 w-0.5 flex-1 rounded-full transition-colors duration-500",
                        a.status === "done" ? "bg-yesil/50" : "bg-cizgi",
                      )}
                    />
                  )}
                </div>
                <div className={cn("min-w-0 flex-1", son ? "pb-0" : "pb-5")}>
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
                        d.zemin,
                        d.renk,
                      )}
                    >
                      <DurumIkonu durum={a.status} className="size-3" />
                      {d.etiket}
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
