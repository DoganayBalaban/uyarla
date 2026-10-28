"use client"

import { ExternalLink, Search } from "lucide-react"
import { phaseAt, phaseReached, typedSlice } from "@/features/landing/demos/demoScript"
import { JOB_PHASES, JOB_SCENE, type JobPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import s from "@/features/landing/landing.module.css"

/** Bul sahnesinin `ms` anındaki karesi. Saf. */
export function JobSearchFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(JOB_PHASES, ms)
  const at = (id: JobPhase) => phaseReached(JOB_PHASES, phase, id)
  const query = phase === "query" ? typedSlice(JOB_SCENE.keywords, progress) : at("sites") ? JOB_SCENE.keywords : ""
  return (
    <div className="space-y-4">
      <div>
        <p className={s.mockLabel}>İş ara</p>
        <p className={s.mockTitle}>Hedef rolün: {JOB_SCENE.role}</p>
        <p className={s.mockSmall}>Eklediğin: {JOB_SCENE.added.join(" · ")}</p>
      </div>
      <div className="flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <span className="truncate">{query}</span>
        {phase === "query" && <span className="inline-block h-4 w-px animate-pulse bg-foreground" />}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {JOB_SCENE.links.map((l, i) => {
          const shown = at("sites") && (phase !== "sites" || progress >= i / JOB_SCENE.links.length)
          const pressed = at("open") && l.site === "linkedin"
          return (
            <li
              key={l.site}
              style={{ opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(6px)" }}
              className={`rounded-lg border bg-background p-3 transition-all duration-300 ${pressed ? "border-primary" : ""}`}
            >
              <p className="text-sm font-semibold">{l.label}</p>
              <p className="text-xs text-muted-foreground">{l.note}</p>
              <span className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${pressed ? "text-primary" : "text-muted-foreground"}`}>
                Aç <ExternalLink size={12} />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function JobSearchDemo() {
  return (
    <Scene
      label="İş arama: profildeki rol ve şehirle kurulan sorgu Kariyer.net, LinkedIn, Jooble ve Careerjet'in kendi arama sayfalarında açılıyor."
      phases={JOB_PHASES}
    >
      {(ms) => <JobSearchFilm ms={ms} />}
    </Scene>
  )
}
