"use client"

import { motion, useReducedMotion } from "motion/react"
import { BriefcaseBusiness, FileText, GitCompareArrows } from "lucide-react"
import { PaperSheet, WaitingFrame, type SheetState, type WaitingStep } from "@/components/waiting/WaitingFrame"
import { cn } from "@/lib/cn"

/** Marka rehberi §10.2'deki yükleme metinleri; worker'ın aşama kimlikleri. */
export const ANALYSIS_STEPS: WaitingStep[] = [
  { id: "reading_resume", short: "CV", title: "CV'ni okuyoruz", description: "Deneyim, eğitim ve becerilerin ayrıştırılıyor." },
  { id: "reading_posting", short: "İlan", title: "İlanı okuyoruz", description: "Gereksinimler ve aranan kavramlar çıkarılıyor." },
  { id: "comparing", short: "Karşılaştırma", title: "İlanla karşılaştırıyoruz", description: "Her gereksinim CV'nde kanıtıyla aranıyor." },
]

/** Ürünün gerçek kuralları; istatistik ya da kanıtsız iddia yok (rehber §11). */
const FACTS = [
  "Skor, CV'nin ilanla ne kadar örtüştüğünü ölçer; işe ne kadar uygun olduğunu değil.",
  "Bir gereksinim ancak CV'ndeki bir ifadeye dayanıyorsa karşılanmış sayılır; kanıtını raporda görürsün.",
  "Zorunlu gereksinimler skorda tercih edilenlerin iki katı sayılır.",
  "Yanlış okunduğunu düşündüğün bir şartı raporda işaretleyebilir ya da düzeltebilirsin.",
  "CV'n analiz için OpenAI'a gönderilir; satılmaz, model eğitiminde kullanılmaz.",
]

/** Gönderilen formdan ekrana taşınanlar; sayfa yenilenince yok, iskelet çiziliyor. */
export interface AnalysisInput {
  resumeLabel: string | null
  /** Yalnızca yapıştırılan CV'de; dosyanın metni tarayıcıda okunmuyor. */
  resumeLines: string[] | null
  postingLines: string[] | null
}

export function AnalysisWaiting({
  stage,
  startedAt,
  input,
}: {
  stage: string | null
  startedAt?: number | null
  input?: AnalysisInput | null
}) {
  const index = Math.max(0, ANALYSIS_STEPS.findIndex((s) => s.id === stage))
  const resumeState: SheetState = index === 0 ? "active" : "done"
  const postingState: SheetState = index === 0 ? "idle" : index === 1 ? "active" : "done"
  const comparing = index === 2
  // İlanın ilk satırı çoğunlukla pozisyon adı: kâğıdın başlığı o.
  const [postingTitle, ...postingRest] = input?.postingLines ?? []

  return (
    <WaitingFrame
      eyebrow="Analiz"
      steps={ANALYSIS_STEPS}
      activeId={stage}
      startedAt={startedAt}
      facts={FACTS}
      footnote="Genelde bir dakika kadar sürüyor. Başka sayfaya geçebilirsin; bitince haber veririz."
    >
      <div className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-stretch gap-1 sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)] sm:gap-2">
        <PaperSheet
          label="CV"
          icon={FileText}
          title={input?.resumeLabel ?? "CV'n"}
          lines={input?.resumeLines}
          state={resumeState}
          className="h-56 sm:h-64"
        />
        <Threads active={comparing} />
        <PaperSheet
          label="İlan"
          icon={BriefcaseBusiness}
          title={postingTitle ?? "İlan"}
          lines={postingRest.length > 0 ? postingRest : null}
          state={postingState}
          className="h-56 sm:h-64"
        />
      </div>
    </WaitingFrame>
  )
}

/** Satırdan satıra kıvrılan bağlar; karşılaştırmada akıyor. */
const PATHS = ["M0,60 C50,60 50,110 100,110", "M0,120 C50,120 50,55 100,55", "M0,175 C50,175 50,165 100,165"]

function Threads({ active }: { active: boolean }) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div className="relative" aria-hidden>
      <svg viewBox="0 0 100 220" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        {PATHS.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
            className={cn("transition-colors duration-500", active ? "stroke-primary" : "stroke-border")}
            initial={false}
            animate={active && !reducedMotion ? { strokeDashoffset: [0, -16] } : { strokeDashoffset: 0 }}
            transition={active && !reducedMotion ? { duration: 0.9 + i * 0.25, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={cn(
            "relative grid size-9 place-items-center rounded-full border bg-background shadow-xs transition-colors duration-500 sm:size-11",
            active ? "border-primary/60 text-primary" : "text-muted-foreground",
          )}
        >
          {active && !reducedMotion && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.5], opacity: [0.45, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <GitCompareArrows className="size-4 sm:size-5" />
        </span>
      </div>
    </div>
  )
}
