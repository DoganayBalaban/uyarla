"use client"

import { FileText, MousePointer2, Puzzle } from "lucide-react"
import { UyarlaIcon } from "@/components/brand/UyarlaMark"
import { phaseAt, phaseReached, span } from "@/features/landing/demos/demoScript"
import { DemoRing } from "@/features/landing/demos/parts"
import { EXT_PHASES, EXT_SCENE, type ExtPhase } from "@/features/landing/demos/scenes"
import { Scene } from "@/features/landing/demos/useScenePlayer"
import { EXTENSION_ACTION_TITLE } from "@/features/landing/extension"
import s from "@/features/landing/landing.module.css"

/** Eklenti sahnesinin `ms` anındaki karesi. Saf. */
export function ExtensionFilm({ ms }: { ms: number }) {
  const { phase, progress } = phaseAt(EXT_PHASES, ms)
  const at = (id: ExtPhase) => phaseReached(EXT_PHASES, phase, id)
  const uyarlaTab = at("open")
  // İmleç sayfanın ortasından araç çubuğundaki simgeye gidiyor.
  const t = phase === "point" ? span(progress, 0, 1) : at("click") ? 1 : 0
  const cursor = { left: `${55 + (88 - 55) * t}%`, top: `${62 + (11 - 62) * t}%` }
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
        <span
          className={`grid size-6 place-items-center rounded-md transition-transform ${phase === "click" ? "scale-90 bg-primary/15" : ""} ${
            phase === "point" && progress > 0.7 ? "bg-muted" : ""
          }`}
        >
          <UyarlaIcon className="h-3 w-auto text-primary" />
        </span>
      </div>
      {phase === "point" && progress > 0.7 && (
        <span className="absolute top-[46px] right-2 z-10 rounded bg-foreground px-2 py-0.5 text-[11px] text-background">{EXTENSION_ACTION_TITLE}</span>
      )}
      {/* Sayfa */}
      <div className="min-h-56 p-4">
        {!uyarlaTab ? (
          <div className="space-y-2">
            <p className="m-0 text-base font-semibold">{EXT_SCENE.title}</p>
            <p className="m-0 text-xs text-muted-foreground">{EXT_SCENE.company} · İstanbul · Hibrit</p>
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
      label="Chrome eklentisi: ilan sayfasında uyarla simgesine basılınca uyarla ilan metni dolu açılıyor ve skor çıkıyor."
      phases={EXT_PHASES}
    >
      {(ms) => <ExtensionFilm ms={ms} />}
    </Scene>
  )
}
