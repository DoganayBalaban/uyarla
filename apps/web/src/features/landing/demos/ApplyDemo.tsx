"use client"

import { Check, Copy } from "lucide-react"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { APPLY_PHASES, APPLY_SCENE, type ApplyPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Başvur sahnesinin `ms` anındaki karesi. Saf. */
export function ApplyFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(APPLY_PHASES, ms)
  const at = (id: ApplyPhase) => phaseReached(APPLY_PHASES, phase, id)
  const answer = phase === "answer" ? typedSlice(APPLY_SCENE.answer, progress) : at("check") ? APPLY_SCENE.answer : ""
  return (
    <div className="space-y-4">
      <div>
        <p className={s.mockLabel}>Başvuru formu</p>
        <p className={s.mockTitle}>{APPLY_SCENE.question}</p>
      </div>
      <div className="rounded-lg border bg-background p-3 text-sm">
        <p className="min-h-10">{answer}</p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {answer.length}/{APPLY_SCENE.limit}
          </span>
          {at("check") && (
            <span className="inline-flex items-center gap-1 font-medium text-brand-green">
              <Check size={12} /> Sınır içinde
            </span>
          )}
        </div>
      </div>
      <div style={{ opacity: at("letter") ? 1 : 0 }} className="rounded-lg border bg-background p-3 text-sm transition-opacity duration-500">
        <p className={s.mockLabel}>Ön yazı</p>
        <p className="mt-1">{APPLY_SCENE.letter}</p>
        <p className="mt-2 inline-block rounded bg-brand-green/10 px-2 py-0.5 text-xs">CV&apos;nden: “{APPLY_SCENE.letterEvidence}”</p>
      </div>
      <div className="flex justify-end">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${at("copy") ? "border-brand-green text-brand-green" : ""}`}
        >
          {at("copy") ? <Check size={12} /> : <Copy size={12} />} {at("copy") ? "Kopyalandı" : "Kopyala"}
        </span>
      </div>
    </div>
  )
}

export function ApplyDemo() {
  return (
    <Scene
      label="Başvuru formu: “140 karakterde neden sen?” sorusu CV'deki cümlelerle sınır içinde yanıtlanıyor; ön yazı paragrafı kaynağını gösteriyor ve kopyalanıyor."
      phases={APPLY_PHASES}
    >
      {(ms) => <ApplyFilm ms={ms} />}
    </Scene>
  )
}
