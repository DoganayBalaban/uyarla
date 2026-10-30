"use client"

import { FileText, MousePointer2, Puzzle } from "lucide-react"
import { UyarlaIcon } from "@/components/brand/UyarlaMark"
import { phaseAt, phaseReached, span } from "@/features/landing/demos/demoScript"
import { DemoRing } from "@/features/landing/demos/parts"
import { EXT_PHASES, EXT_SCENE, type ExtPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import { EXTENSION_PAGE_BUTTON } from "@/features/landing/extension"
import s from "@/features/landing/landing.module.css"

/** Eklenti sahnesinin `ms` anındaki karesi. Saf. */
export function ExtensionFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(EXT_PHASES, ms)
  const at = (id: ExtPhase) => phaseReached(EXT_PHASES, phase, id)
  const uyarlaTab = at("open")
  // İmleç sayfanın ortasından ilanın yanındaki uyarla düğmesine gidiyor (eklenti 0.4.0, DOG-169).
  const t = phase === "point" ? span(progress, 0, 1) : at("click") ? 1 : 0
  const cursor = { left: `${62 + (35 - 62) * t}%`, top: `${74 + (49 - 74) * t}%` }
  return (
    <div className="relative space-y-0 overflow-hidden rounded-lg border bg-background text-sm">
      {/* Sekmeler */}
      <div className="flex gap-1 border-b bg-muted/60 px-2 pt-2 text-xs">
        <span className={`truncate rounded-t-md px-3 py-1.5 ${uyarlaTab ? "text-muted-foreground" : "bg-background font-medium"}`}>
          {EXT_SCENE.title} — {EXT_SCENE.company}
        </span>
        {uyarlaTab && <span className="truncate rounded-t-md bg-background px-3 py-1.5 font-medium">uyarla · Yeni analiz</span>}
      </div>
      {/* Adres çubuğu ve eklenti simgeleri */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex-1 truncate rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {uyarlaTab ? "uyarla.com.tr/analyze" : `${EXT_SCENE.host}/ilan/frontend-gelistirici`}
        </span>
        <Puzzle size={14} className="text-muted-foreground" />
        <span className="grid size-6 place-items-center rounded-md">
          <UyarlaIcon className="h-3 w-auto text-primary" />
        </span>
      </div>
      {/* Sayfa */}
      <div className="min-h-56 p-4">
        {!uyarlaTab ? (
          <div className="space-y-2">
            <p className="m-0 text-base font-semibold">{EXT_SCENE.title}</p>
            <p className="m-0 text-xs text-muted-foreground">{EXT_SCENE.company} · İstanbul · Hibrit</p>
            {/* Sitenin kendi düğmeleri ve yanında eklentinin düğmesi. */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="rounded-md bg-muted px-3 py-1 text-xs font-medium">Başvur</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground ring-3 ring-primary/20 transition-transform ${
                  phase === "click" ? "scale-95" : ""
                }`}
              >
                <UyarlaIcon className="h-2.5 w-auto" />
                {EXTENSION_PAGE_BUTTON}
              </span>
            </div>
            <ul className="m-0 mt-3 list-disc space-y-1 pl-4 text-xs">
              {EXT_SCENE.posting.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : !at("score") ? (
          <div className="space-y-2">
            <p className={s.mockLabel}>Yeni analiz</p>
            <p className="m-0 flex items-center gap-1.5 text-xs">
              <FileText size={12} /> {EXT_SCENE.resume} · Temel CV
            </p>
            <div className="rounded-md border p-2 text-xs">
              <p className="m-0 font-medium">
                {EXT_SCENE.title} — {EXT_SCENE.company}
              </p>
              {EXT_SCENE.posting.map((line) => (
                <p key={line} className="m-0 text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
            <p className="m-0 text-xs text-muted-foreground">Analiz başlıyor…</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <DemoRing score={EXT_SCENE.score} />
            <div>
              <p className={s.mockLabel}>ATS uyum skoru</p>
              <p className="m-0 font-semibold">
                {EXT_SCENE.title} — {EXT_SCENE.company}
              </p>
              <p className="m-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText size={12} /> {EXT_SCENE.resume}
              </p>
            </div>
          </div>
        )}
      </div>
      {!at("open") && <MousePointer2 size={18} className="absolute z-20 fill-background text-foreground" style={cursor} />}
    </div>
  )
}

export function ExtensionDemo() {
  return (
    <Scene
      label="Chrome eklentisi: ilan sayfasında başvuru düğmesinin yanındaki uyarla düğmesine basılınca uyarla ilan metni dolu açılıyor ve skor çıkıyor."
      phases={EXT_PHASES}
    >
      {(ms) => <ExtensionFilm ms={ms} />}
    </Scene>
  )
}
