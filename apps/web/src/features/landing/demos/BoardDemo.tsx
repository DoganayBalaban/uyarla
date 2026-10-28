"use client"

import { STAGE_LABEL, STAGES } from "@/features/applications/board"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { BOARD_PHASES, BOARD_SCENE, type BoardPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Takip et sahnesinin `ms` anındaki karesi. Saf. */
export function BoardFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(BOARD_PHASES, ms)
  const at = (id: BoardPhase) => phaseReached(BOARD_PHASES, phase, id)
  const column = at("interview") ? "interview" : at("adapted") ? "applied" : "saved"
  const score = at("adapted") ? BOARD_SCENE.after : BOARD_SCENE.before
  const note = phase === "note" ? typedSlice(BOARD_SCENE.note, progress) : at("hold") ? BOARD_SCENE.note : ""
  return (
    <div className="space-y-3">
      <p className={s.mockLabel}>Başvurular</p>
      {/* Dar ekranda hikâyenin geçtiği ilk üç sütun; Teklif ve Olmadı sm'den itibaren. */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {STAGES.map((stage, i) => (
          <div key={stage} className={`min-h-24 rounded-lg bg-background p-1.5 ${i > 2 ? "hidden sm:block" : ""}`}>
            <p className="truncate text-[11px] font-medium text-muted-foreground">{STAGE_LABEL[stage]}</p>
            {stage === column && (
              <div
                className={`mt-1.5 rounded-md border bg-card p-1.5 text-[11px] shadow-xs transition-transform ${phase === "drag" ? "translate-x-3 rotate-2" : ""}`}
              >
                <p className="font-medium break-words">{BOARD_SCENE.position}</p>
                <p className={`mt-1 font-semibold tabular-nums ${at("adapted") ? "text-brand-green" : "text-brand-amber"}`}>{score}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {phase === "gate" && (
        <div className="rounded-lg border bg-background p-3 text-sm shadow-sm">
          <p className="font-semibold">Önce uyarlamak ister misin?</p>
          <p className="mt-1 text-muted-foreground">{BOARD_SCENE.missingMust} zorunlu gereksinim CV&apos;nde görünmüyor.</p>
          <div className="mt-2 flex justify-end gap-2 text-xs">
            <span className="rounded border px-2 py-1">Yine de başvur</span>
            <span className="rounded bg-primary px-2 py-1 text-primary-foreground">Uyarla</span>
          </div>
        </div>
      )}
      {at("note") && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className={s.mockLabel}>Teşekkür notu taslağı</p>
          <p className="mt-1">
            {note.split("[ad]").map((part, i, all) => (
              <span key={i}>
                {part}
                {i < all.length - 1 && <mark className="rounded bg-brand-amber/20 px-0.5">[ad]</mark>}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  )
}

export function BoardDemo() {
  return (
    <Scene
      label="Başvuru panosu: düşük skorlu kart başvurulmadan önce uyarlama öneriyor; uyarlanınca 41 skorla Başvuruldu'ya, sonra Mülakat'a geçiyor ve teşekkür notu taslağı hazırlanıyor."
      phases={BOARD_PHASES}
    >
      {(ms) => <BoardFilm ms={ms} />}
    </Scene>
  )
}
