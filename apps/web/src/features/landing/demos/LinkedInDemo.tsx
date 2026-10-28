"use client"

import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { LINKEDIN_PHASES, LINKEDIN_SCENE, type LinkedInPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import { SECTION_LABELS, STATUS_LABELS } from "@/features/linkedin/sections"
import s from "@/features/landing/landing.module.css"

/** Ürünün başlık biçimi: "Unvan | beceri, beceri" (core/linkedin/suggest). */
const [ROLE_PART, ...SKILL_PARTS] = LINKEDIN_SCENE.parts
const NEW_HEADLINE = `${ROLE_PART!.text} | ${SKILL_PARTS.map((p) => p.text).join(", ")}`

/** Görünür ol sahnesinin `ms` anındaki karesi. Saf. */
export function LinkedInFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(LINKEDIN_PHASES, ms)
  const at = (id: LinkedInPhase) => phaseReached(LINKEDIN_PHASES, phase, id)
  const headline = phase === "rewrite" ? typedSlice(NEW_HEADLINE, progress) : at("evidence") ? NEW_HEADLINE : LINKEDIN_SCENE.before
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">EY</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Elif Yılmaz</p>
          <p className="text-sm text-muted-foreground">{headline}</p>
        </div>
      </div>
      {at("audit") && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="flex items-center gap-2">
            <span className="font-medium">{SECTION_LABELS.headline}</span>
            <span className="rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs">{STATUS_LABELS.improve}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{LINKEDIN_SCENE.reason}</p>
        </div>
      )}
      {at("evidence") && (
        <ul className="grid gap-1.5 text-xs">
          {LINKEDIN_SCENE.parts.map((p) => (
            <li key={p.text} className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-medium">{p.text}</span>
              <span className="rounded bg-brand-green/10 px-1.5 py-0.5">{p.source.kind === "profile" ? `Profilinde: “${p.source.quote}”` : "Hedef rolün"}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-right text-xs text-muted-foreground">
        Eklentiyle profilini aktar · <span className="rounded-full border px-1.5 py-0.5">Yakında</span>
      </p>
    </div>
  )
}

export function LinkedInDemo() {
  return (
    <Scene
      label="LinkedIn denetimi: “Yazılım Geliştirici” başlığında hedef unvan geçmiyor; başlık hedef rol ve profildeki becerilerden “Frontend Geliştirici | React, TypeScript, Kod incelemesi” olarak yeniden yazılıyor."
      phases={LINKEDIN_PHASES}
    >
      {(ms) => <LinkedInFilm ms={ms} />}
    </Scene>
  )
}
