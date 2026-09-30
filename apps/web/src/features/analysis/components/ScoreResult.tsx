"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { FormatReportCard as FormatReport, type FormatReportView } from "@/features/analysis/components/FormatReport"
import { ScoreRing as ScoreRing, skorDurumu as scoreStatus } from "@/features/analysis/components/ScoreRing"

export interface RequirementResult {
  requirement: { text: string; importance: string; type: string }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  evidence: { text: string; kind: string } | null
}

export interface ScoreResultView {
  score: number
  requirements: RequirementResult[]
  missingKeywords: string[]
  /** Biçim kontrolü; eski analizlerde ve kontrol patladığında yok. */
  format?: FormatReportView | null
}

type FilterBar = "all" | "missing" | "satisfied"

const IMPORTANCE_LABEL: Record<string, string> = {
  must: "Zorunlu",
  nice: "Tercih sebebi",
}

/**
 * Analiz sonucunun gösterimi.
 *
 * Üstte skor kartı (rehber §9.5: skor ekranın en büyük öğesi), altında
 * biçim raporu, süzülebilir gereksinim listesi ve eksik kavramlar.
 * Gereksinim satırları 21st.dev'deki akordeon/liste bileşenlerinin
 * desenini izliyor: kanıt yalnızca açılınca görünüyor, ekran sakin kalıyor.
 */
export function ScoreResult({
  result,
  durationMs,
  tokenUsage,
  modelId,
  adapting,
  error,
  onAdapt,
  onYeniAnaliz,
}: {
  result: ScoreResultView
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  adapting: boolean
  error?: string | null
  onAdapt?: () => void
  onYeniAnaliz?: () => void
}) {
  const reducedMotion = useReducedMotion() ?? false
  const [activeFilter, setFilter] = useState<FilterBar>("all")
  const state = scoreStatus(result.score)
  const satisfiedCount = result.requirements.filter((r) => r.status === "matched").length
  const missing = result.requirements.length - satisfiedCount
  const visible = result.requirements.filter((r) =>
    activeFilter === "all" ? true : activeFilter === "missing" ? r.status === "missing" : r.status === "matched",
  )

  const entrance = (delayMs: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: delayMs, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <section className="space-y-6">
      {/* Skor kartı. */}
      <motion.div
        {...entrance(0)}
        className="relative overflow-hidden rounded-kart border border-cizgi bg-kart p-6 shadow-sm sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-mavi/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={result.score} size={148} className="shrink-0 self-center sm:self-auto" />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-gri uppercase">Uyum skoru</p>
            <h1 className="mt-1 text-2xl sm:text-3xl">
              {result.requirements.length} gereksinimin{" "}
              <span className={state.textClass}>{satisfiedCount} tanesi</span> karşılanıyor
            </h1>
            <p className="mt-2 text-sm text-gri">
              {missing > 0
                ? "Uyarladığımızda eksikleri deneyiminin izin verdiği ölçüde kapatıyoruz; olmayan bir şeyi eklemiyoruz."
                : "CV'n bu ilanın istediklerini karşılıyor. Yine de anlatımı ilanın diline yaklaştırabilirsin."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {onAdapt && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-3 font-semibold text-white shadow-sm shadow-mavi/30 transition hover:bg-mavi/90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={adapting}
                  onClick={onAdapt}
                >
                  {adapting ? (
                    <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  {adapting ? "Hazırlanıyor…" : "CV'mi bu ilana uyarla"}
                  {!adapting && <ArrowRight className="size-4" aria-hidden />}
                </button>
              )}
              {onYeniAnaliz && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-buton border border-cizgi bg-kart px-4 py-3 text-sm font-semibold transition hover:border-mavi/40 hover:text-mavi"
                  onClick={onYeniAnaliz}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Yeni analiz
                </button>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-buton bg-kirmizi/10 px-3 py-2 text-sm text-kirmizi dark:text-[#f87171]"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {result.format && (
        <motion.div {...entrance(0.08)}>
          <FormatReport report={result.format} />
        </motion.div>
      )}

      {/* Gereksinimler. */}
      <motion.div {...entrance(0.14)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg">Gereksinimler</h2>
          <div role="tablist" aria-label="Gereksinimleri süz" className="inline-flex rounded-buton bg-zemin p-1 text-sm">
            {(
              [
                ["all", `Hepsi · ${result.requirements.length}`],
                ["missing", `Eksik · ${missing}`],
                ["satisfied", `Karşılanan · ${satisfiedCount}`],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                role="tab"
                aria-selected={activeFilter === val}
                onClick={() => setFilter(val)}
                className={cn(
                  "rounded-[8px] px-3 py-1.5 font-medium transition",
                  activeFilter === val ? "bg-kart text-metin shadow-sm" : "text-gri hover:text-metin",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-gri">Bu süzgeçte gereksinim yok.</p>
        ) : (
          <ul className="mt-4 divide-y divide-cizgi">
            {visible.map((item, i) => (
              <RequirementRow key={`${activeFilter}-${i}`} item={item} />
            ))}
          </ul>
        )}
      </motion.div>

      {/* Eksik kavramlar. */}
      <motion.div {...entrance(0.2)} className="rounded-kart border border-cizgi bg-kart p-5 sm:p-6">
        <h2 className="m-0 text-lg">Eksik kavramlar</h2>
        <p className="mt-1 text-sm text-gri">İlanda geçen ama CV&apos;nde karşılığını bulamadığımız kavramlar.</p>
        {result.missingKeywords.length === 0 ? (
          <p className="mt-3 text-sm text-gri">Eksik kavram yok.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {result.missingKeywords.map((k) => (
              <li
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-cizgi bg-zemin px-3 py-1 text-sm"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-mercan" />
                {k}
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <details className="group rounded-kart border border-cizgi bg-kart px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-gri">
          Teknik ayrıntı
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-sm text-gri">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre className="mt-2 max-h-[32rem] overflow-x-auto rounded-buton border border-cizgi bg-zemin p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </section>
  )
}

function RequirementRow({ item }: { item: RequirementResult }) {
  const [open, setOpen] = useState(false)
  const done = item.status === "matched"
  const importanceLabel = IMPORTANCE_LABEL[item.requirement.importance] ?? item.requirement.importance

  return (
    <li className="py-3">
      <button
        type="button"
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={item.evidence ? open : undefined}
        onClick={() => item.evidence && setOpen((a) => !a)}
        disabled={!item.evidence}
      >
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
            done
              ? "bg-yesil/15 text-yesil dark:text-[#4ade80]"
              : "bg-kirmizi/10 text-kirmizi dark:text-[#f87171]",
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
          <span className="sr-only">{done ? "Karşılanıyor" : "Eksik"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{item.requirement.text}</span>
          <span className="ml-2 inline-block rounded-full bg-zemin px-2 py-0.5 align-middle text-[11px] font-semibold text-gri">
            {importanceLabel}
          </span>
        </span>
        {item.evidence && (
          <ChevronDown
            className={cn("mt-1 size-4 shrink-0 text-gri transition", open && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
      {item.evidence && open && (
        <p className="mt-2 ml-8 rounded-buton border-l-2 border-yesil/60 bg-zemin px-3 py-2 text-sm text-gri">
          <span className="font-semibold text-metin">CV&apos;nde bunu karşılayan:</span> {item.evidence.text}
        </p>
      )}
    </li>
  )
}
