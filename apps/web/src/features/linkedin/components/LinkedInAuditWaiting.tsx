"use client"

import { BriefcaseBusiness, GraduationCap, IdCard, ListChecks, MessageSquareText, Type } from "lucide-react"
import { SceneCard, Threads } from "@/components/waiting/Scene"
import { PaperSheet, WaitingFrame, useCycle, type SheetState, type WaitingStep } from "@/components/waiting/WaitingFrame"
import type { AuditView } from "@/features/linkedin/audit"

/** Denetimin gerçek adımları; worker kayda yazıyor (DOG-157, spec §4.1). */
export const AUDIT_STEPS: WaitingStep[] = [
  { id: "reading", short: "Okuma", title: "Profilini okuyoruz", description: "Başlık, hakkında, deneyim, eğitim ve beceriler ayrıştırılıyor." },
  { id: "checking", short: "Kontrol", title: "Bölümleri kontrol ediyoruz", description: "Her bölüm, hedefine ve işe alımcının baktığı yerlere göre." },
  { id: "writing", short: "Yazım", title: "Önerilerini yazıyoruz", description: "Öneriler yalnızca profilindeki bilgilerle; her cümle kontrol ediliyor." },
]

const SECTIONS = [
  { id: "headline", label: "Başlık", icon: Type },
  { id: "about", label: "Hakkında", icon: MessageSquareText },
  { id: "experience", label: "Deneyim", icon: BriefcaseBusiness },
  { id: "education", label: "Eğitim", icon: GraduationCap },
  { id: "skills", label: "Beceriler", icon: ListChecks },
]

const FACTS = [
  "Profiline dokunmuyoruz; önerileri kopyalayıp LinkedIn'de sen uygularsın.",
  "Eklenti yalnızca senin tıkladığın, kendi profil sayfanı okur.",
  "Öneriler profilinde yazanlarla yazılır; dayanağı zayıf cümleyi işaretleyip sana sorarız.",
  "Önerileri uygulayıp yeniden taradığında farkı görürsün.",
]

export function LinkedInAuditWaiting({ audit }: { audit: Pick<AuditView, "stage" | "createdAt" | "profile"> }) {
  const stage = audit.stage ?? "reading"
  const checking = stage === "checking"
  const writing = stage === "writing"
  const cursor = useCycle(SECTIONS.length, checking, 900)
  const cardState = (i: number): SheetState => (writing ? "done" : checking ? (cursor === -1 || cursor === i ? "active" : "idle") : "idle")
  const p = audit.profile
  const lines = p ? [p.headline, ...p.experience.map((e) => [e.title, e.company].filter(Boolean).join(" · "))].filter((l): l is string => !!l) : null

  return (
    <WaitingFrame
      eyebrow="LinkedIn denetimi"
      steps={AUDIT_STEPS}
      activeId={stage}
      startedAt={Date.parse(audit.createdAt)}
      facts={FACTS}
      footnote="Genelde bir dakika kadar sürüyor."
      headingLevel={2}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)] sm:gap-2">
        <PaperSheet
          label={writing ? "Öneriler" : "LinkedIn profilin"}
          icon={IdCard}
          title={p?.name ?? null}
          lines={lines}
          state={checking ? "done" : "active"}
          mode={writing ? "write" : "read"}
          className="h-48 sm:h-auto sm:min-h-64"
        />
        <div className="hidden sm:block">
          <Threads active={checking} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="m-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Bölümler</p>
          {SECTIONS.map((s, i) => (
            <SceneCard key={s.id} icon={s.icon} title={s.label} state={cardState(i)} />
          ))}
        </div>
      </div>
    </WaitingFrame>
  )
}
