"use client"

import { Check, Minus, TriangleAlert } from "lucide-react"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { INTERVIEW_PHASES, INTERVIEW_SCENE, type InterviewPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Hazırlan sahnesinin `ms` anındaki karesi. Saf. */
export function InterviewFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(INTERVIEW_PHASES, ms)
  const at = (id: InterviewPhase) => phaseReached(INTERVIEW_PHASES, phase, id)
  const answer = phase === "answer" ? typedSlice(INTERVIEW_SCENE.answer, progress) : at("feedback") ? INTERVIEW_SCENE.answer : ""
  return (
    <div className="space-y-3">
      <div>
        <p className={s.mockLabel}>Mülakat sorusu</p>
        <p className={s.mockTitle}>{INTERVIEW_SCENE.question}</p>
        {at("evidence") && <p className="mt-1 inline-block rounded bg-brand-green/10 px-2 py-0.5 text-xs">CV: “{INTERVIEW_SCENE.evidence}”</p>}
      </div>
      <div className="min-h-16 rounded-lg border bg-background p-3 text-sm">
        <p className={s.mockLabel}>Cevabın</p>
        <p className="mt-1">{answer}</p>
      </div>
      {at("feedback") && (
        <ul className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
          {INTERVIEW_SCENE.star.map((x) => (
            <li key={x.label} className={`flex items-center gap-1 rounded-md border px-2 py-1 ${x.ok ? "" : "text-muted-foreground"}`}>
              {x.ok ? <Check size={12} className="text-brand-green" /> : <Minus size={12} />} {x.label}
            </li>
          ))}
        </ul>
      )}
      {at("flag") && (
        <p className="flex items-start gap-2 rounded-lg bg-brand-amber/10 p-2.5 text-sm">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-brand-amber" />
          <span>
            <strong>Kâğıtta yok:</strong> “{INTERVIEW_SCENE.notOnPaper}” CV&apos;nde geçmiyor.
          </span>
        </p>
      )}
    </div>
  )
}

export function InterviewDemo() {
  return (
    <Scene
      label="Mülakat pratiği: soru CV'deki kanıtıyla geliyor; cevap STAR yapısına göre değerlendiriliyor ve CV'de olmayan “12 geliştirici” ifadesi işaretleniyor."
      phases={INTERVIEW_PHASES}
    >
      {(ms) => <InterviewFilm ms={ms} />}
    </Scene>
  )
}
