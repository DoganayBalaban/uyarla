"use client"

import { Download, Lock } from "lucide-react"
import { DEMO_BULLETS, phaseAt, phaseReached } from "@/features/landing/demos/demoScript"
import { BulletText } from "@/features/landing/demos/parts"
import { CHECK_PHASES, type CheckPhase } from "@/features/landing/demos/scenes"
import s from "@/features/landing/landing.module.css"

const FLAGGED = DEMO_BULLETS.find((b) => b.flag)!

/**
 * Uydurma kontrolünün zamana bağlı hâli (DOG-162): tanıtımdaki CheckDemo
 * tıklamayla oynuyor; dikey videoda aynı kural kendiliğinden akıyor.
 * Abartılı madde işaretli, karar verilene kadar indirme kapalı.
 */
export function CheckFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(CHECK_PHASES, ms)
  const at = (id: CheckPhase) => phaseReached(CHECK_PHASES, phase, id)
  const decided = at("decide")
  const unlocked = at("open")
  // Kilitliyken indirmeye basılınca düğme sallanıyor (üründeki gibi).
  const shake = phase === "locked" && progress < 0.4 ? Math.sin(progress * 60) * 6 : 0
  return (
    <div className="space-y-3">
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
          decided ? "bg-brand-green/15 text-brand-green" : "bg-brand-amber/20 text-brand-amber"
        }`}
      >
        {decided ? "Eski hâli kalacak" : "Kontrol et"}
      </span>
      <div className={s.warningText}>
        <BulletText segments={FLAGGED.segments} decision={decided ? "old" : undefined} />
      </div>
      {at("flag") && !decided && <p className="m-0 text-sm text-brand-amber">{FLAGGED.flag}</p>}
      <div className={s.warningButtons}>
        <span className={`${s.fakeSecondary} ${decided ? "ring-2 ring-brand-blue/40" : ""}`}>Eski hâli kalsın</span>
        <span className={`${s.fakePrimary} ${decided ? "opacity-40" : ""}`}>Yeni hâlini kullan</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <span
          style={{ transform: `translateX(${shake}px)` }}
          className={`inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold ${
            unlocked ? "bg-brand-blue text-white" : "bg-border text-muted-foreground"
          }`}
        >
          {unlocked ? <Download size={16} /> : <Lock size={16} />}
          PDF indir
        </span>
        <span className="text-sm text-muted-foreground">
          {unlocked ? "Karar verildi, indirme açık." : "İşaretli maddeye karar verene kadar indirme kapalı."}
        </span>
      </div>
    </div>
  )
}
