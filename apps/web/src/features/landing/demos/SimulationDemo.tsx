"use client"

import { Check, Minus, SendHorizontal, TriangleAlert } from "lucide-react"
import { INTERVIEWER_NAME } from "@uyarla/core/interview/simulationRecord"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { SCENE_ROLE, SIMULATION_PHASES, SIMULATION_SCENE, type SimulationPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/**
 * Simülasyon sahnesinin `ms` anındaki karesi (DOG-173). Saf; tanıtım
 * sayfası da Remotion videosu da bunu çiziyor. Ekran ürünün kendisi:
 * aynı balonlar, aynı "yazıyor", aynı rapor.
 */
export function SimulationFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(SIMULATION_PHASES, ms)
  const at = (id: SimulationPhase) => phaseReached(SIMULATION_PHASES, phase, id)
  const sent = at("typing")
  const draft = phase === "answer" ? typedSlice(SIMULATION_SCENE.answer, Math.min(1, progress * 1.15)) : ""
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2.5 border-b pb-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold">{INTERVIEWER_NAME}</p>
          <p className="m-0 truncate text-xs text-muted-foreground">Görüşmeci · {SCENE_ROLE}</p>
        </div>
        <span className="mr-8 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums">{SIMULATION_SCENE.progress}</span>
      </div>

      {/* Gelecek öğeler baştan yer kaplıyor (görünmez): kart büyüyüp sayfayı itmesin. */}
      <Slot>
        <Show when={phase === "opening"}>
          <Typing ms={ms} />
        </Show>
        <Show when={at("question")}>
          <Bubble from="interviewer">{SIMULATION_SCENE.question}</Bubble>
        </Show>
      </Slot>

      {/* Yazma kutusu sorunun hemen altında; gönderilince yerini cevap ve ek soru alıyor. */}
      <Slot>
        <Show when={at("question") && !sent}>
          <div className="flex items-end gap-2 rounded-lg border bg-background p-2.5">
            <p className={`m-0 min-h-10 flex-1 text-sm ${draft ? "" : "text-muted-foreground"}`}>{draft || "Mülakatta söyleyeceğin gibi yaz…"}</p>
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <SendHorizontal size={14} />
            </span>
          </div>
        </Show>
        <Show when={sent}>
          <div className="space-y-2.5">
            <Bubble from="candidate">{SIMULATION_SCENE.answer}</Bubble>
            <Slot>
              <Show when={phase === "typing"}>
                <Typing ms={ms} />
              </Show>
              <Show when={at("probe")}>
                <Bubble from="interviewer">{SIMULATION_SCENE.probe}</Bubble>
              </Show>
            </Slot>
          </div>
        </Show>
      </Slot>

      <Show when={at("report")}>
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className={s.mockLabel} style={{ marginBottom: 0 }}>
            Geri bildirim
          </p>
          <ul className="m-0 grid list-none grid-cols-4 gap-1.5 p-0 text-xs">
            {SIMULATION_SCENE.star.map((x) => (
              <li key={x.label} className={`flex items-center gap-1 rounded-md border bg-card px-2 py-1 ${x.ok ? "" : "text-muted-foreground"}`}>
                {x.ok ? <Check size={12} className="text-brand-green" /> : <Minus size={12} />} {x.label}
              </li>
            ))}
          </ul>
          <p className="m-0 flex items-start gap-2 rounded-md bg-brand-amber/10 p-2 text-xs">
            <TriangleAlert size={13} className="mt-0.5 shrink-0 text-brand-amber" />
            <span>
              <strong>Kâğıtta yok:</strong> “{SIMULATION_SCENE.notOnPaper}” CV&apos;nde geçmiyor; sorulursa kanıtlayabilmelisin.
            </span>
          </p>
        </div>
      </Show>
    </div>
  )
}

/** Aynı yeri paylaşan öğeler: üst üste, kap en büyüğü kadar. */
function Slot({ children }: { children: React.ReactNode }) {
  return <div className="grid [&>*]:[grid-area:1/1]">{children}</div>
}

/** Yer kaplar ama yalnızca `when` iken görünür. */
function Show({ when, children }: { when: boolean; children: React.ReactNode }) {
  return <div className={when ? "" : "invisible"}>{children}</div>
}

function Avatar({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary ${small ? "size-6 text-[11px]" : "size-8 text-sm"}`}
    >
      {INTERVIEWER_NAME[0]}
    </span>
  )
}

function Bubble({ from, children }: { from: "interviewer" | "candidate"; children: React.ReactNode }) {
  if (from === "candidate") {
    return (
      <div className="flex justify-end">
        <p className="m-0 max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-[13px] leading-snug text-primary-foreground">{children}</p>
      </div>
    )
  }
  return (
    <div className="flex items-end gap-2">
      <Avatar small />
      <p className="m-0 max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[13px] leading-snug">{children}</p>
    </div>
  )
}

/** Görüşmeci yazıyor: sırayla koyulaşan üç nokta; hareket `ms`'ten, Remotion'da da aynı. */
function Typing({ ms }: { ms: number }) {
  const lit = Math.floor(ms / 220) % 3
  return (
    <div className="flex items-end gap-2">
      <Avatar small />
      <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5">
        {[0, 1, 2].map((d) => (
          <span key={d} className={`size-1.5 rounded-full ${d === lit ? "bg-muted-foreground" : "bg-muted-foreground/35"}`} />
        ))}
      </span>
    </div>
  )
}

export function SimulationDemo() {
  return (
    <Scene
      label={`Mülakat simülasyonu: görüşmeci ${INTERVIEWER_NAME} soruyu soruyor, aday cevabında CV'de olmayan “12 geliştirici” diyor, ${INTERVIEWER_NAME} bunun üstüne gidiyor; sonunda STAR geri bildirimi ve “kâğıtta yok” uyarısı.`}
      phases={SIMULATION_PHASES}
    >
      {(ms) => <SimulationFilm ms={ms} />}
    </Scene>
  )
}
