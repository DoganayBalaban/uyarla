"use client"

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { Check, ChevronDown, X } from "lucide-react"
import { useRef, useState } from "react"
import { DEMO_REQUIREMENTS } from "@/features/landing/demos/demoScript"
import { DemoRing } from "@/features/landing/demos/parts"
import s from "@/features/landing/landing.module.css"

/**
 * Gereksinim listesi, canlı: ekrana girince satırlar sırayla taranır;
 * satıra tıklayınca CV'deki kanıt ya da neden eksik olduğu açılır.
 */
export function RequirementDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const reduced = useReducedMotion()
  const shown = inView || reduced
  const [open, setOpen] = useState<string | null>(DEMO_REQUIREMENTS[2]?.text ?? null)
  const matched = DEMO_REQUIREMENTS.filter((r) => r.evidence).length

  return (
    <div ref={ref} className={`${s.mock} ${s.mockWide}`}>
      <div className={s.mockTop}>
        <div>
          <p className={s.mockLabel}>İlan gereksinimleri</p>
          <p className={s.mockTitle}>
            {DEMO_REQUIREMENTS.length} gereksinimden {matched}'ü karşılanıyor
          </p>
          <p className={s.mockSmall}>Bir satıra tıkla, nedenini gör.</p>
        </div>
        <DemoRing score={shown ? 31 : 0} />
      </div>
      <ul className="flex flex-col">
        {DEMO_REQUIREMENTS.map((r, i) => {
          const isOpen = open === r.text
          const ok = Boolean(r.evidence)
          return (
            <motion.li
              key={r.text}
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={shown ? { opacity: 1, x: 0 } : undefined}
              transition={{ delay: reduced ? 0 : 0.15 + i * 0.12, duration: 0.35 }}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.text)}
                className="flex w-full cursor-pointer items-start gap-3 rounded-lg py-3 text-left transition-colors hover:bg-background"
              >
                <motion.span
                  initial={reduced ? false : { scale: 0 }}
                  animate={shown ? { scale: 1 } : undefined}
                  transition={{ delay: reduced ? 0 : 0.3 + i * 0.12, type: "spring", stiffness: 500, damping: 20 }}
                  className={ok ? s.statusMatched : s.statusMissing}
                >
                  {ok ? <Check size={14} /> : <X size={14} />}
                </motion.span>
                <span className="flex-1">
                  <span className={s.requirementText}>
                    {r.text} <span className={s.importance}>{r.importance}</span>
                  </span>
                </span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }} className="mt-0.5 text-muted-foreground">
                  <ChevronDown size={16} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p
                      className={`mb-3 ml-9 rounded-lg px-3 py-2 text-sm ${
                        ok ? "bg-brand-green/10 text-foreground" : "bg-brand-red/5 text-foreground"
                      }`}
                    >
                      {r.evidence ? (
                        <>
                          “{r.evidence.quote}” <span className="text-muted-foreground">· {r.evidence.section}</span>
                        </>
                      ) : (
                        r.why
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
