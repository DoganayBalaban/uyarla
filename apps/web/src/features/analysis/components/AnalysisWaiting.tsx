"use client"

import { BriefcaseBusiness, FileText } from "lucide-react"
import { Threads } from "@/components/waiting/Scene"
import { PaperSheet, WaitingFrame, type SheetState, type WaitingStep } from "@/components/waiting/WaitingFrame"

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
