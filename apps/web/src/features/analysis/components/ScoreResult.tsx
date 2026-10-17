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
import { ScoreRing } from "@/features/analysis/components/ScoreRing"
import { isPartial, partialNote, summarizeRequirements } from "@/features/analysis/requirementSummary"
import { scoreStatus } from "@/lib/scoreStatus"
import { withTitleFinding } from "@/features/analysis/titleFinding"
import { applyExclusions } from "@/features/analysis/exclusion"
import type { TitleMatch } from "@uyarla/core"

export interface RequirementResult {
  requirement: { text: string; importance: string; type: string }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  evidence: { text: string; kind: string } | null
  /** Eksik kavramlar; eski kayıtlarda yok (DOG-90 sayımı için). */
  missingConcepts?: string[]
}

export interface ScoreResultView {
  score: number
  requirements: RequirementResult[]
  missingKeywords: string[]
  /** Biçim kontrolü; eski analizlerde ve kontrol patladığında yok. */
  format?: FormatReportView | null
  /** İlan unvanı CV'de geçiyor mu (DOG-87); eski analizlerde yok. */
  titleMatch?: TitleMatch | null
  /** "İlanda yok, yanlış okunmuş" işaretleri (DOG-90). */
  excluded?: number[]
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
  adaptNote,
  onYeniAnaliz,
  onToggleExcluded,
}: {
  result: ScoreResultView
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  adapting: boolean
  error?: string | null
  onAdapt?: () => void
  /** Uyarla düğmesinin altında: bu uyarlamanın neyi harcayacağı (DOG-81). */
  adaptNote?: string | null
  onYeniAnaliz?: () => void
  /** Gereksinimi "ilanda yok" diye işaretler ya da geri alır (DOG-90); yoksa düğme çıkmıyor. */
  onToggleExcluded?: (requirementIndex: number, excluded: boolean) => Promise<void>
}) {
  const reducedMotion = useReducedMotion() ?? false
  const [activeFilter, setFilter] = useState<FilterBar>("all")
  const exclusion = applyExclusions(result)
  const state = scoreStatus(exclusion.score)
  const summary = summarizeRequirements(exclusion.active)
  const format = withTitleFinding(result.format, result.titleMatch)
  const satisfiedCount = summary.matched
  const missing = summary.total - satisfiedCount
  // İşaretli gereksinimler yalnızca "Hepsi"nde, soluk duruyor.
  const visible = exclusion.rows.filter(({ item, excluded }) =>
    activeFilter === "all" ? true : !excluded && (activeFilter === "missing" ? item.status === "missing" : item.status === "matched"),
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
        className="relative overflow-hidden rounded-card border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-blue/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={exclusion.score} size={148} className="shrink-0 self-center sm:self-auto" />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Uyum skoru</p>
            <h1 className="mt-1 text-2xl sm:text-3xl">
              {exclusion.active.length} gereksinimin{" "}
              <span className={state.textClass}>{satisfiedCount} tanesi</span> karşılanıyor
            </h1>
            {/* Zorunlular ayrıca: işe alımcının ilk baktığı yer (DOG-66). Sayının
                ardından ek getirmiyoruz; "5'i / 6'sı" sayıya göre değişiyor. */}
            {(summary.mustTotal > 0 || summary.partial > 0) && (
              <p className="mt-1.5 text-sm font-medium text-foreground">
                {summary.mustTotal > 0 && (
                  <>
                    Zorunlu gereksinimler: {summary.mustMatched} / {summary.mustTotal} karşılanıyor
                  </>
                )}
                {summary.mustTotal > 0 && summary.partial > 0 && " · "}
                {partialNote(summary)}
              </p>
            )}
            {exclusion.excludedCount > 0 && (
              <p className="mt-1 text-sm text-muted">
                İlanda olmadığını işaretlediğin {exclusion.excludedCount} gereksinim skora katılmıyor (ilk skor{" "}
                {result.score}).
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              {missing > 0
                ? "Uyarladığımızda eksikleri deneyiminin izin verdiği ölçüde kapatıyoruz; olmayan bir şeyi eklemiyoruz."
                : "CV'n bu ilanın istediklerini karşılıyor. Yine de anlatımı ilanın diline yaklaştırabilirsin."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {onAdapt && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-5 py-3 font-semibold text-white shadow-sm shadow-brand-blue/30 transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex items-center gap-2 rounded-button border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:border-brand-blue/40 hover:text-brand-blue"
                  onClick={onYeniAnaliz}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Yeni analiz
                </button>
              )}
            </div>
            {onAdapt && adaptNote && <p className="mt-2 text-sm text-muted">{adaptNote}</p>}

            {error && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-button bg-brand-red/10 px-3 py-2 text-sm text-brand-red dark:text-[#f87171]"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {format && (
        <motion.div {...entrance(0.08)}>
          <FormatReport report={format} />
        </motion.div>
      )}

      {/* Gereksinimler. */}
      <motion.div {...entrance(0.14)} className="rounded-card border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-lg">Gereksinimler</h2>
          <div role="tablist" aria-label="Gereksinimleri süz" className="inline-flex rounded-button bg-background p-1 text-sm">
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
                  activeFilter === val ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Bu süzgeçte gereksinim yok.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {visible.map(({ item, index, excluded }) => (
              <RequirementRow
                key={`${activeFilter}-${index}`}
                item={item}
                excluded={excluded}
                onToggleExcluded={onToggleExcluded ? (ex) => onToggleExcluded(index, ex) : undefined}
              />
            ))}
          </ul>
        )}
      </motion.div>

      {/* Eksik kavramlar. */}
      <motion.div {...entrance(0.2)} className="rounded-card border border-border bg-card p-5 sm:p-6">
        <h2 className="m-0 text-lg">Eksik kavramlar</h2>
        <p className="mt-1 text-sm text-muted">İlanda geçen ama CV&apos;nde karşılığını bulamadığımız kavramlar.</p>
        {exclusion.missingKeywords.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Eksik kavram yok.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {exclusion.missingKeywords.map((k) => (
              <li
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-brand-coral" />
                {k}
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <details className="group rounded-card border border-border bg-card px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted">
          Teknik ayrıntı
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-sm text-muted">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre className="mt-2 max-h-[32rem] overflow-x-auto rounded-button border border-border bg-background p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </section>
  )
}

function RequirementRow({
  item,
  excluded = false,
  onToggleExcluded,
}: {
  item: RequirementResult
  excluded?: boolean
  onToggleExcluded?: (excluded: boolean) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const toggle = async (ex: boolean) => {
    if (!onToggleExcluded) return
    setSaving(true)
    try {
      await onToggleExcluded(ex)
    } finally {
      setSaving(false)
    }
  }
  const done = item.status === "matched"
  const partial = isPartial(item)
  const importanceLabel = IMPORTANCE_LABEL[item.requirement.importance] ?? item.requirement.importance

  if (excluded) {
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-muted">
        <span className="min-w-0 flex-1 line-through decoration-muted/60">{item.requirement.text}</span>
        <span className="text-xs">İlanda yok olarak işaretlendi · skora katılmıyor</span>
        {onToggleExcluded && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void toggle(false)}
            className="text-xs font-semibold text-brand-blue underline-offset-2 hover:underline disabled:opacity-50"
          >
            Geri al
          </button>
        )}
      </li>
    )
  }

  return (
    <li className="group py-3">
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
              ? "bg-brand-green/15 text-brand-green dark:text-[#4ade80]"
              : "bg-brand-red/10 text-brand-red dark:text-[#f87171]",
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
          <span className="sr-only">{partial ? "Kısmen karşılanıyor" : done ? "Karşılanıyor" : "Eksik"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{item.requirement.text}</span>
          <span className="ml-2 inline-block rounded-full bg-background px-2 py-0.5 align-middle text-[11px] font-semibold text-muted">
            {importanceLabel}
          </span>
          {partial && (
            <span className="ml-1.5 inline-block rounded-full bg-brand-amber/10 px-2 py-0.5 align-middle text-[11px] font-semibold text-brand-amber">
              Kısmen
            </span>
          )}
        </span>
        {item.evidence && (
          <ChevronDown
            className={cn("mt-1 size-4 shrink-0 text-muted transition", open && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
      {item.evidence && open && (
        <p className="mt-2 ml-8 rounded-button border-l-2 border-brand-green/60 bg-background px-3 py-2 text-sm text-muted">
          <span className="font-semibold text-foreground">CV&apos;nde bunu karşılayan:</span> {item.evidence.text}
        </p>
      )}
      {/* Kavram ayırma bazen ilanda olmayan bir şart üretiyor; kullanıcı
          düzeltebilsin, işaret de bize hata verisi olsun (DOG-90). */}
      {onToggleExcluded && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void toggle(true)}
          className="mt-1 ml-8 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline focus-visible:opacity-100 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
        >
          İlanda böyle bir şart yok mu? Yanlış okunmuş olarak işaretle
        </button>
      )}
    </li>
  )
}
