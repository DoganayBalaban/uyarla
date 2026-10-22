"use client"

import { Braces, FileText, MessagesSquare, SearchX } from "lucide-react"
import { SceneCard, Threads } from "@/components/waiting/Scene"
import { PaperSheet, WaitingFrame, useCycle, type SheetState, type WaitingStep } from "@/components/waiting/WaitingFrame"
import type { PrepWaitingPreview } from "@/features/applications/prepWaiting"

/** Paketin gerçek adımları (DOG-136); hangisinde olduğunu worker kayda yazıyor. */
export const PREP_STEPS: WaitingStep[] = [
  {
    id: "reading",
    short: "Okuma",
    title: "Gönderdiğin belgeleri okuyoruz",
    description: "Başvurduğun CV, ön yazı ve ilanın eksik kalan şartları.",
  },
  {
    id: "writing",
    short: "Yazım",
    title: "Olası soruları ve cevap iskeletlerini yazıyoruz",
    description: "Kanıtlar CV'nden birebir alınıyor ve kontrol ediliyor.",
  },
]

/** Soru türleri; tanımları hazırlık istemindekiyle aynı (core interview/prep). */
const KINDS = [
  { id: "technical", label: "Teknik", meta: "İlanın teknik gereksinimlerinden", icon: Braces },
  { id: "behavioral", label: "Davranışsal", meta: "Deneyiminden örnek isteyen", icon: MessagesSquare },
  { id: "gap", label: "Boşluk", meta: "CV'nde zayıf kalan konulardan", icon: SearchX },
]

const FACTS = [
  "Kanıtlar CV'nden birebir alınıyor; kağıtta olmayan bir iddiayı mülakatta da kurma.",
  "Köşeli parantezli yerleri kendi bildiğinle doldurursun.",
  "Cevabını yazıp pratik yapabilirsin; geri bildirim STAR yapısına, güçlü ve geliştirilecek yanlarına bakar.",
]

export function InterviewPrepWaiting({
  stage,
  startedAt,
  preview,
}: {
  stage: string | null
  startedAt?: number | null
  preview: PrepWaitingPreview | null
}) {
  const writing = stage === "writing" || stage === "completed"
  const cursor = useCycle(KINDS.length, writing, 1400)
  const cardState = (i: number): SheetState => (!writing ? "idle" : cursor === -1 || cursor === i ? "active" : "idle")
  const gaps = preview?.gaps ?? []

  return (
    <WaitingFrame
      eyebrow="Hazırlık paketi"
      steps={PREP_STEPS}
      activeId={stage}
      startedAt={startedAt}
      facts={FACTS}
      footnote="Bir dakika kadar sürebilir."
      headingLevel={2}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:gap-2">
        <PaperSheet
          label="CV'n"
          icon={FileText}
          lines={preview?.lines}
          state={writing ? "done" : "active"}
          className="h-44 sm:h-auto sm:min-h-64"
        />
        <div className="hidden sm:block">
          <Threads active={writing} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="m-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Soru kartları</p>
          {KINDS.map((kind, i) => (
            <SceneCard key={kind.id} icon={kind.icon} title={kind.label} meta={kind.meta} state={cardState(i)} writing />
          ))}
          {gaps.length > 0 && (
            <div className="mt-1 rounded-lg border border-dashed p-3">
              <p className="m-0 text-xs font-semibold">İlanın karşılanmayan şartları</p>
              <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
                {gaps.map((gap) => (
                  <li key={gap} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-coral" aria-hidden />
                    <span className="min-w-0 truncate">{gap}</span>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-2 text-[11px] leading-snug text-muted-foreground">
                Her biri için dürüst bir cevap önerisi yazılıyor: doğrudan deneyimin olmadığını söyleyip en yakın deneyimini
                anlatan.
              </p>
            </div>
          )}
        </div>
      </div>
    </WaitingFrame>
  )
}
