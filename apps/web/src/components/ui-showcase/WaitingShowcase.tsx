"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ADAPTATION_STEPS, AdaptationWaiting } from "@/features/adaptation/components/AdaptationWaiting"
import { ANALYSIS_STEPS, AnalysisWaiting } from "@/features/analysis/components/AnalysisWaiting"
import { SAMPLE_REPORT_POSTING } from "@/features/analysis/sampleReport"
import { previewLines } from "@/components/waiting/text"

/** Kurgusal örnek (eval cv-d-pazarlama); gerçek kişi değil. */
const RESUME = `Deniz Aksoy
Performance Marketing Specialist
E-ticaret ve ajans tarafında 4 yıllık performans pazarlaması deneyimim var.
Facebook ve Instagram reklam kampanyalarını aylık bütçeyle yönettim.
Google arama ve alışveriş kampanyalarında ROAS'ı artırdım.
GA4 ve Looker Studio ile haftalık performans panolarını hazırladım.`

const PREVIEW = {
  headline: "Performance Marketing Specialist",
  lines: previewLines(RESUME, 7, 140).slice(2),
  missing: ["Meta Business Suite", "Google Analytics 4", "Excel pivot tablo", "E-posta pazarlama araçları"],
  startedAt: new Date().toISOString(),
}

export function WaitingShowcase() {
  const [screen, setScreen] = useState<"analysis" | "adaptation">("analysis")
  const [stage, setStage] = useState<string>("reading_resume")
  const [withInput, setWithInput] = useState(true)
  const steps = screen === "analysis" ? ANALYSIS_STEPS : ADAPTATION_STEPS

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={screen}
          onValueChange={(v) => {
            if (!v) return
            setScreen(v as typeof screen)
            setStage(v === "analysis" ? ANALYSIS_STEPS[0]!.id : ADAPTATION_STEPS[0]!.id)
          }}
        >
          <ToggleGroupItem value="analysis">Analiz</ToggleGroupItem>
          <ToggleGroupItem value="adaptation">Uyarlama</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" variant="outline" value={stage} onValueChange={(v) => v && setStage(v)}>
          {steps.map((s) => (
            <ToggleGroupItem key={s.id} value={s.id}>
              {s.short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup type="single" variant="outline" value={withInput ? "veri" : "bos"} onValueChange={(v) => v && setWithInput(v === "veri")}>
          <ToggleGroupItem value="veri">Veriyle</ToggleGroupItem>
          <ToggleGroupItem value="bos">Verisiz</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {screen === "analysis" ? (
        <AnalysisWaiting
          stage={stage}
          input={
            withInput
              ? { resumeLabel: "Yapıştırılan CV", resumeLines: previewLines(RESUME), postingLines: previewLines(SAMPLE_REPORT_POSTING.text, 12) }
              : null
          }
        />
      ) : (
        <AdaptationWaiting stage={stage} scoreBefore={withInput ? 34 : null} preview={withInput ? PREVIEW : null} />
      )}
    </main>
  )
}
