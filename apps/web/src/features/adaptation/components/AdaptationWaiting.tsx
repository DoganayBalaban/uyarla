"use client"

import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, FileText, Search } from "lucide-react"
import { PaperSheet, WaitingFrame, useCycle, type WaitingStep } from "@/components/waiting/WaitingFrame"
import type { WaitingPreview } from "@/features/adaptation/waiting"
import { cn } from "@/lib/cn"
import { scoreStatus } from "@/lib/scoreStatus"

/** Worker'ın aşama kimlikleri (`AdaptStage`); metinler rehber §10.2 tonunda. */
export const ADAPTATION_STEPS: WaitingStep[] = [
  {
    id: "rewriting",
    short: "Yazım",
    title: "CV'ni ilana göre yeniden yazıyoruz",
    description: "Özetini ve deneyim maddelerini ilanın diline yaklaştırıyoruz.",
  },
  {
    id: "verifying",
    short: "Kontrol",
    title: "Hiçbir şeyin uydurulmadığını kontrol ediyoruz",
    description: "Her yeni cümleyi CV'ndeki gerçek bilgilerle karşılaştırıyoruz.",
  },
]

/** Ürünün gerçek kuralları; istatistik yok (rehber §11). */
const FACTS = [
  "Deneyimin uydurulmaz; her değişiklik CV'ndeki bir ifadeye dayanır.",
  "Dayanağı zayıf görünen cümleyi işaretleyip sana soruyoruz; kalıp kalmayacağına sen karar verirsin.",
  "Her değişikliği sen onaylarsın; istemediğini eski hâline döndürürsün.",
  "Uyarlanmış CV'ni sade bir şablonla PDF ya da DOCX olarak indirirsin.",
  "Aynı ilan için ön yazı da isteyebilirsin.",
]

export function AdaptationWaiting({
  stage,
  scoreBefore,
  preview,
}: {
  stage: string | null
  scoreBefore: number | null
  preview: WaitingPreview | null
}) {
  const verifying = stage === "verifying"
  const startedAt = preview ? Date.parse(preview.startedAt) : null

  return (
    <WaitingFrame
      eyebrow="Uyarlama"
      steps={ADAPTATION_STEPS}
      activeId={stage}
      startedAt={Number.isFinite(startedAt) ? startedAt : null}
      facts={FACTS}
      footnote="Genelde bir dakikadan kısa sürüyor; hazır olunca bu sayfa kendiliğinden açılır."
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <PaperSheet
          label="CV'n"
          icon={FileText}
          title={preview?.headline}
          lines={preview?.lines}
          state="active"
          mode={verifying ? "verify" : "write"}
          className="order-2 h-60 sm:order-1 sm:h-auto sm:min-h-72"
        />
        <div className="order-1 flex flex-col gap-4 sm:order-2">
          {scoreBefore !== null && <ScoreBeforeAfter before={Math.round(scoreBefore)} />}
          {/* Önizleme yoksa eksikleri bilmiyoruz; "kalmadı" demek yanlış olur. */}
          {preview && <MissingConcepts missing={preview.missing} searching={!verifying} />}
        </div>
      </div>
    </WaitingFrame>
  )
}

function ScoreBeforeAfter({ before }: { before: number }) {
  const reducedMotion = useReducedMotion() ?? false
  const status = scoreStatus(before)
  const r = 20
  const circumference = 2 * Math.PI * r
  return (
    <div className="flex items-center justify-center gap-4 rounded-lg border bg-card p-3 shadow-xs">
      <figure className="m-0 flex flex-col items-center gap-1">
        <div className="relative size-14" role="img" aria-label={`Önceki skor ${before}, ${status.label}`}>
          <svg viewBox="0 0 48 48" className="size-full -rotate-90" aria-hidden>
            <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-border" />
            <circle
              cx="24"
              cy="24"
              r={r}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className={status.strokeClass}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, before)) / 100)}
            />
          </svg>
          <span className={cn("absolute inset-0 grid place-items-center text-base font-bold tabular-nums", status.textClass)}>{before}</span>
        </div>
        <figcaption className="text-[11px] font-medium text-muted-foreground">Önce</figcaption>
      </figure>
      <ArrowRight className="mb-5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <figure className="m-0 flex flex-col items-center gap-1">
        <div
          className="grid size-14 place-items-center rounded-full border-2 border-dashed border-primary/40 text-lg font-bold text-primary"
          role="img"
          aria-label="Yeni skor uyarlama bitince"
        >
          <motion.span
            aria-hidden
            animate={reducedMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            ?
          </motion.span>
        </div>
        <figcaption className="text-[11px] font-medium text-muted-foreground">Sonra</figcaption>
      </figure>
    </div>
  )
}

/** Analizde eksik kalan kavramlar; yazım sürerken sırayla "aranıyor". */
function MissingConcepts({ missing, searching }: { missing: string[]; searching: boolean }) {
  const cursor = useCycle(missing.length, searching, 1300)
  return (
    <div className="min-w-0 flex-1 rounded-lg border bg-card p-3 shadow-xs">
      <p className="m-0 text-xs font-semibold">Analizde eksik kalanlar</p>
      {missing.length === 0 ? (
        <p className="m-0 mt-1.5 text-xs text-muted-foreground">
          Eksik kavram kalmadı; anlatımı ilanın diline yaklaştırıyoruz.
        </p>
      ) : (
        <>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
            {missing.map((term, i) => (
              <li
                key={term}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors duration-300",
                  cursor === i ? "border-primary/50 bg-primary/10 text-foreground" : "border-dashed text-muted-foreground",
                )}
              >
                {cursor === i ? (
                  <Search className="size-3 shrink-0 text-primary" aria-hidden />
                ) : (
                  <span className="size-1.5 shrink-0 rounded-full bg-brand-coral" aria-hidden />
                )}
                <span className="truncate">{term}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-[11px] leading-snug text-muted-foreground">
            Deneyiminde dayanağı olanlar cümlelere işlenir; dayanağı olmayan eklenmez.
          </p>
        </>
      )}
    </div>
  )
}
