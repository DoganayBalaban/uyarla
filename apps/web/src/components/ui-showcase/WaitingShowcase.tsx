"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ADAPTATION_STEPS, AdaptationWaiting } from "@/features/adaptation/components/AdaptationWaiting"
import { ANALYSIS_STEPS, AnalysisWaiting } from "@/features/analysis/components/AnalysisWaiting"
import { SAMPLE_REPORT_POSTING } from "@/features/analysis/sampleReport"
import { previewLines } from "@/components/waiting/text"
import { InterviewPrepWaiting, PREP_STEPS } from "@/features/applications/components/InterviewPrepWaiting"
import { AUDIT_STEPS, LinkedInAuditWaiting } from "@/features/linkedin/components/LinkedInAuditWaiting"

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

type Screen = "analysis" | "adaptation" | "linkedin" | "interview"

const STEPS: Record<Screen, Array<{ id: string; short: string }>> = {
  analysis: ANALYSIS_STEPS,
  adaptation: ADAPTATION_STEPS,
  linkedin: AUDIT_STEPS,
  interview: PREP_STEPS,
}

export function WaitingShowcase() {
  const [screen, setScreen] = useState<Screen>("analysis")
  const [stage, setStage] = useState<string>("reading_resume")
  const [withInput, setWithInput] = useState(true)
  const steps = STEPS[screen]

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          value={screen}
          onValueChange={(v) => {
            if (!v) return
            setScreen(v as Screen)
            setStage(STEPS[v as Screen][0]!.id)
          }}
        >
          <ToggleGroupItem value="analysis">Analiz</ToggleGroupItem>
          <ToggleGroupItem value="adaptation">Uyarlama</ToggleGroupItem>
          <ToggleGroupItem value="linkedin">LinkedIn</ToggleGroupItem>
          <ToggleGroupItem value="interview">Mülakat</ToggleGroupItem>
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

      {screen === "linkedin" && (
        <LinkedInAuditWaiting
          audit={{
            stage,
            createdAt: new Date().toISOString(),
            profile: withInput
              ? {
                  name: "Deniz Aksoy",
                  headline: "Performance Marketing Specialist",
                  about: null,
                  experience: [{ title: "Performance Marketing Specialist", company: "Moda Sepeti", dateRange: null, location: null, description: null }],
                  education: [],
                  certifications: [],
                  skills: [],
                  languages: [],
                  truncated: {},
                }
              : null,
          }}
        />
      )}
      {screen === "interview" && (
        <InterviewPrepWaiting
          stage={stage}
          preview={withInput ? { lines: PREVIEW.lines, gaps: ["Google Analytics 4 ile raporlama", "Excel'de pivot tablo ve temel formüller"] } : null}
        />
      )}
      {screen === "analysis" ? (
        <AnalysisWaiting
          stage={stage}
          input={
            withInput
              ? { resumeLabel: "Yapıştırılan CV", resumeLines: previewLines(RESUME), postingLines: previewLines(SAMPLE_REPORT_POSTING.text, 12) }
              : null
          }
        />
      ) : screen === "adaptation" ? (
        <AdaptationWaiting stage={stage} scoreBefore={withInput ? 34 : null} preview={withInput ? PREVIEW : null} />
      ) : null}
    </main>
  )
}
