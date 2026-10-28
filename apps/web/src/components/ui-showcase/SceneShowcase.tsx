"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { loopMs, phaseAt } from "@/features/landing/demos/demoScript"
import { SCENE_LIST } from "@/features/landing/demos/sceneList"
import s from "@/features/landing/landing.module.css"

/** Tanıtım sahneleri, an seçilerek (DOG-160). Yalnızca yerelde. */
export function SceneShowcase() {
  const [id, setId] = useState(SCENE_LIST[0]!.id)
  const [ms, setMs] = useState(0)
  const scene = SCENE_LIST.find((x) => x.id === id)!
  const loop = loopMs(scene.phases)
  const { phase } = phaseAt(scene.phases, ms)
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <ToggleGroup
        type="single"
        variant="outline"
        value={id}
        onValueChange={(v) => {
          if (!v) return
          setId(v)
          setMs(0)
        }}
      >
        {SCENE_LIST.map((x) => (
          <ToggleGroupItem key={x.id} value={x.id}>
            {x.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap gap-2 text-sm">
        {scene.phases.map((p, i) => {
          const start = scene.phases.slice(0, i).reduce((t, q) => t + q.ms, 0)
          return (
            <button
              key={p.id}
              type="button"
              className={`rounded border px-2 py-1 ${p.id === phase ? "bg-muted font-semibold" : ""}`}
              onClick={() => setMs(start + p.ms - 1)}
            >
              {p.id}
            </button>
          )
        })}
      </div>
      <input type="range" min={0} max={loop - 1} value={ms} onChange={(e) => setMs(Number(e.target.value))} className="w-full" aria-label="An" />
      <div className={s.page}>
        <div className={`${s.mock} ${s.mockWide}`}>
          <scene.Film ms={ms} />
        </div>
      </div>
    </main>
  )
}
