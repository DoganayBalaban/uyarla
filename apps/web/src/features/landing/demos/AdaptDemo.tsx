"use client"

import { motion } from "motion/react"
import { Link2, RotateCcw } from "lucide-react"
import { useState } from "react"
import {
  DEMO_BASE_SCORE,
  DEMO_BULLETS,
  demoScore,
  type Decision,
  type Decisions,
} from "@/features/landing/demos/demoScript"
import { BulletText, DecisionToggle, DemoRing } from "@/features/landing/demos/parts"
import s from "@/features/landing/landing.module.css"

/**
 * Uyarlama ekranı, oynanabilir: her maddede yeni ya da eski hâli seç, skor
 * seçimlere göre güncellensin. Üründeki gibi her yeni ifade, dayandığı cümleyle.
 */
const BULLETS = DEMO_BULLETS.filter((b) => !b.flag)

export function AdaptDemo() {
  const [decisions, setDecisions] = useState<Decisions>({})
  const decided = BULLETS.filter((b) => decisions[b.id]).length
  const score = demoScore(decisions)
  const set = (id: string, d: Decision) => setDecisions((cur) => ({ ...cur, [id]: d }))

  return (
    <div className={`${s.mock} ${s.mockWide}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className={s.mockLabel}>Deneyim maddeleri</p>
          <p className={s.mockTitle}>
            {decided}/{BULLETS.length} karar verildi
          </p>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-brand-blue"
              animate={{ width: `${(decided / BULLETS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {score > DEMO_BASE_SCORE && (
            <motion.span
              key={score}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs font-bold text-brand-green"
            >
              +{score - DEMO_BASE_SCORE}
            </motion.span>
          )}
          <DemoRing score={score} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {BULLETS.map((b) => (
          <div key={b.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{b.label}</span>
              <DecisionToggle id={b.id} value={decisions[b.id]} onChange={(d) => set(b.id, d)} />
            </div>
            <BulletText segments={b.segments} decision={decisions[b.id]} />
            {decisions[b.id] !== "old" && (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {b.evidence.map((e) => (
                  <li key={e.term} className="flex gap-1.5">
                    <Link2 size={13} className="mt-0.5 shrink-0" />
                    <span>
                      <b className="text-foreground">{e.term}</b>, senin “{e.quote}” ifadene dayanıyor.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {decided > 0 && (
        <button
          type="button"
          onClick={() => setDecisions({})}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <RotateCcw size={12} /> Baştan dene
        </button>
      )}
    </div>
  )
}
