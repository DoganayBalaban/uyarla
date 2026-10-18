"use client"

import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import { Download, Lock, RotateCcw } from "lucide-react"
import { useState } from "react"
import { DEMO_BULLETS, downloadUnlocked, type Decisions } from "@/features/landing/demos/demoScript"
import { BulletText } from "@/features/landing/demos/parts"
import s from "@/features/landing/landing.module.css"

/**
 * Uydurma kontrolü, oynanabilir: işaretli maddeye karar verilmeden indirme
 * kilitli (üründeki kural). Kilitliyken indirmeye basınca düğme sallanır.
 */
const FLAGGED = DEMO_BULLETS.filter((b) => b.flag)

export function CheckDemo() {
  const [decisions, setDecisions] = useState<Decisions>({})
  const [downloaded, setDownloaded] = useState(false)
  const shake = useAnimationControls()
  const unlocked = downloadUnlocked(decisions)

  const tryDownload = () => {
    if (!unlocked) {
      void shake.start({ x: [0, -8, 8, -6, 6, -3, 0], transition: { duration: 0.45 } })
      return
    }
    setDownloaded(true)
  }

  return (
    <div className={`${s.mock} ${s.mockWide}`}>
      {FLAGGED.map((b) => {
        const d = decisions[b.id]
        return (
          <div key={b.id}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={d ?? "pending"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                  d ? "bg-brand-green/15 text-brand-green" : "bg-brand-amber/20 text-brand-amber"
                }`}
              >
                {d === "old" ? "Eski hâli kalacak" : d === "new" ? "Yeni hâli, senin onayınla" : "Kontrol et"}
              </motion.span>
            </AnimatePresence>
            <div className={s.warningText}>
              <BulletText segments={b.segments} decision={d} />
            </div>
            <AnimatePresence initial={false}>
              {!d && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-1.5 overflow-hidden text-sm text-brand-amber"
                >
                  {b.flag}
                </motion.p>
              )}
            </AnimatePresence>
            <div className={s.warningButtons}>
              {(["old", "new"] as const).map((choice) => (
                <motion.button
                  key={choice}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setDecisions((cur) => ({ ...cur, [b.id]: choice }))}
                  aria-pressed={d === choice}
                  className={`cursor-pointer ${choice === "old" ? s.fakeSecondary : s.fakePrimary} ${
                    d && d !== choice ? "opacity-40" : ""
                  }`}
                >
                  {choice === "old" ? "Eski hâli kalsın" : "Yeni hâlini kullan"}
                </motion.button>
              ))}
            </div>
          </div>
        )
      })}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <motion.button
          type="button"
          animate={shake}
          onClick={tryDownload}
          aria-disabled={!unlocked}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors ${
            unlocked ? "bg-brand-blue text-white hover:bg-brand-blue-hover" : "bg-border text-muted"
          }`}
        >
          {unlocked ? <Download size={16} /> : <Lock size={16} />}
          {downloaded ? "İndirildi" : "PDF indir"}
        </motion.button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={unlocked ? "open" : "locked"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted"
          >
            {unlocked ? "Karar verildi, indirme açık." : "İşaretli maddeye karar verene kadar indirme kapalı."}
          </motion.span>
        </AnimatePresence>
      </div>

      {Object.keys(decisions).length > 0 && (
        <button
          type="button"
          onClick={() => {
            setDecisions({})
            setDownloaded(false)
          }}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          <RotateCcw size={12} /> Baştan dene
        </button>
      )}
    </div>
  )
}
