"use client"

import { BriefcaseBusiness, IdCard } from "lucide-react"
import { SceneCard, Threads } from "@/components/waiting/Scene"
import { PaperSheet, WaitingFrame, useCycle, type SheetState, type WaitingStep } from "@/components/waiting/WaitingFrame"

/** Raporun gerçek adımları (DOG-136); hangisinde olduğunu worker kayda yazıyor. */
export const REPORT_STEPS: WaitingStep[] = [
  {
    id: "reading",
    short: "Profil",
    title: "Profilini okuyoruz",
    description: "LinkedIn PDF'indeki deneyim, beceri ve Hakkında bölümü ayrıştırılıyor.",
  },
  {
    id: "scoring",
    short: "İlanlar",
    title: "İlanlarla karşılaştırıyoruz",
    description: "Seçtiğin her ilanın gereksinimleri profilinde aranıyor.",
  },
  {
    id: "writing",
    short: "Öneri",
    title: "Başlık ve Hakkında önerisi yazıyoruz",
    description: "Öneri, profilinde yazanlara karşı kontrol ediliyor.",
  },
]

const FACTS = [
  "Profiline dokunmuyoruz; önerileri LinkedIn'de sen uygularsın.",
  "Profil sayfanı biz çekmiyoruz; yalnızca yüklediğin PDF okunuyor.",
  "Rapor, seçtiğin ilanların gereksinimlerini profilinde arar ve eksik kalan becerileri gösterir.",
  "Başlık ve Hakkında önerisi, profilinde yazanlara karşı kontrol ediliyor.",
]

export function LinkedInWaiting({
  stage,
  startedAt,
  profileLabel,
  postings,
}: {
  stage: string | null
  startedAt?: number | null
  profileLabel: string | null
  /** Rapora seçilen ilanlar; panodan pozisyon ve şirket adıyla. */
  postings: Array<{ id: string; position: string; company: string | null }>
}) {
  const index = Math.max(0, REPORT_STEPS.findIndex((s) => s.id === (stage === "completed" ? "writing" : stage)))
  const scoring = index === 1
  const writing = index === 2
  const cursor = useCycle(postings.length, scoring, 1100)
  const postingState = (i: number): SheetState =>
    writing ? "done" : scoring ? (cursor === -1 || cursor === i ? "active" : "idle") : "idle"

  return (
    <WaitingFrame
      eyebrow="LinkedIn raporu"
      steps={REPORT_STEPS}
      activeId={stage}
      startedAt={startedAt}
      facts={FACTS}
      footnote="Genelde bir dakika kadar sürüyor."
      headingLevel={2}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:gap-2">
        <PaperSheet
          label={writing ? "Başlık · Hakkında" : "LinkedIn profilin"}
          icon={IdCard}
          title={profileLabel}
          state={scoring ? "done" : "active"}
          mode={writing ? "write" : "read"}
          className="h-44 sm:h-auto sm:min-h-60"
        />
        <div className="hidden sm:block">
          <Threads active={scoring} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="m-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Hedeflediğin ilanlar</p>
          {postings.length > 0 ? (
            postings.map((p, i) => (
              <SceneCard key={p.id} icon={BriefcaseBusiness} title={p.position} meta={p.company} state={postingState(i)} />
            ))
          ) : (
            <SceneCard icon={BriefcaseBusiness} title="Seçtiğin ilanlar" state={writing ? "done" : scoring ? "active" : "idle"} />
          )}
        </div>
      </div>
    </WaitingFrame>
  )
}
