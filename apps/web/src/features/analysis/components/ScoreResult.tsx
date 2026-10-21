"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { FormatReportCard as FormatReport, type FormatReportView } from "@/features/analysis/components/FormatReport"
import { ImpactBadge } from "@/features/analysis/components/ImpactBadge"
import { TitleCorrection } from "@/features/analysis/components/TitleCorrection"
import { ResultGuide } from "@/features/analysis/components/ResultGuide"
import { scoreImpacts, type ScoreImpact } from "@/features/analysis/scoreImpact"
import { ScoreRing } from "@/features/analysis/components/ScoreRing"
import { isPartial, partialNote, summarizeRequirements } from "@/features/analysis/requirementSummary"
import { scoreStatus } from "@/lib/scoreStatus"
import { readiness, readinessHint } from "@/features/analysis/readiness"
import { navStatus, resultNav, type ResultNavItem } from "@/features/analysis/resultNav"
import { keywordSpans } from "@uyarla/core/normalize/highlight"
import { PlatformTips } from "@/features/analysis/components/PlatformTips"
import type { PlatformId } from "@/features/analysis/platforms"
import { withTitleFinding } from "@/features/analysis/titleFinding"
import { applyExclusions } from "@/features/analysis/exclusion"
import type { ExclusionMark, RequirementCorrection, RequirementReport } from "@uyarla/core/score/exclusions"
import type { TitleMatch } from "@uyarla/core/score/title"
import type { LanguageCheck } from "@uyarla/core/score/languages"
import type { RequirementAction } from "@/features/analysis/api"
import { CorrectPanel, MarkPanel } from "@/features/analysis/components/RequirementFixes"
import { correctionKind, exclusionLabel } from "@/features/analysis/requirementFix"
import { requiredYears } from "@uyarla/core/score/duration"

export interface RequirementResult {
  requirement: {
    text: string
    importance: string
    type: string
    /** Kavramlar; eğitim şartı düzeltmesinin başlangıç değeri (DOG-90), ilanda vurgu (DOG-133). */
    concepts?: Array<{ term: string; synonyms?: string[] }>
    /** Kullanıcının düzelttiği en az yıl (DOG-90). */
    minYears?: number
  }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  /** `fact`: kanıt daha önce anlatılan bir deneyimden (DOG-116), yüklenen CV'de yok. */
  evidence: { text: string; kind: string; fact?: boolean } | null
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
  /** İşaretlerin nedeni ve kapsamı (DOG-90). */
  exclusions?: Record<number, ExclusionMark>
  /** "CV'mde var" bildirimleri; skoru değiştirmiyor (DOG-90). */
  reports?: RequirementReport[]
  /** İlanın düzeltilmiş şartları (DOG-90). */
  corrections?: Record<number, RequirementCorrection>
  /** İlanın düzeltilmiş unvanı (DOG-134); titleMatch bununla. */
  positionCorrection?: string
  /** Skor formülünün sürümü (DOG-103); eski analizlerde yok. */
  scoringRevision?: number
  /** İlanın istediği dil seviyesi ile CV'deki (DOG-115); eski analizlerde yok. */
  languageChecks?: LanguageCheck[]
  /** Analize katılan, daha önce anlattığın deneyimler (DOG-116). */
  facts?: Array<{ id: string }>
}

const TITLE_LINE: Record<TitleMatch["level"], string> = {
  exact: "İlandaki unvan CV'nde geçiyor",
  partial: "İlandaki unvan CV'nde kısmen geçiyor",
  none: "İlandaki unvan CV'nde geçmiyor",
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
  onRequirementChange,
  onPositionChange,
  platform,
  sourceWarning,
  postingText,
}: {
  result: ScoreResultView
  /** İlan adresinden tanınan platform (DOG-95); ipuçları skor kartının altında. */
  platform?: PlatformId | null
  /** İlan kaynağı uyarısı (DOG-125): bilinmeyen ya da taklit alan adı. */
  sourceWarning?: { tone: "soft" | "strong"; text: string } | null
  /** İlan metni sekmesi (DOG-133); eski yanıtlarda yok. */
  postingText?: string | null
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  adapting: boolean
  error?: string | null
  onAdapt?: () => void
  /** Uyarla düğmesinin altında: bu uyarlamanın neyi harcayacağı (DOG-81). */
  adaptNote?: string | null
  onYeniAnaliz?: () => void
  /** Gereksinimi işaretler, işareti kaldırır ya da şartını düzeltir (DOG-90); yoksa düğmeler çıkmıyor. */
  onRequirementChange?: (requirementIndex: number, change: RequirementAction) => Promise<void>
  /** İlan unvanını düzeltir (DOG-134); null düzeltmeyi kaldırıyor. */
  onPositionChange?: (position: string | null) => Promise<void>
}) {
  const reducedMotion = useReducedMotion() ?? false
  const [activeFilter, setFilter] = useState<FilterBar>("all")
  // Rapor ya da ilan metni (DOG-133); "İlanda göster" ilgili terimleri vurgular.
  const [tab, setTab] = useState<"report" | "posting">("report")
  const [highlight, setHighlight] = useState<{ label: string; terms: string[] } | null>(null)
  const showInPosting = (item: RequirementResult) => {
    const terms = (item.requirement.concepts ?? []).flatMap((c) => [c.term, ...(c.synonyms ?? [])])
    setHighlight({ label: item.requirement.text, terms: terms.length ? terms : [item.requirement.text] })
    setTab("posting")
  }
  const exclusion = applyExclusions(result)
  const state = scoreStatus(exclusion.score)
  const summary = summarizeRequirements(exclusion.active)
  // Kendi eşiğimiz (DOG-91): zorunluların tamamı ve unvan.
  const ready = readiness(result)
  const format = withTitleFinding(result.format, result.titleMatch)
  // Skor etkisi rozetleri (DOG-132): formülün ağırlıklarından.
  const impacts = scoreImpacts(result.scoringRevision)
  // Yapışkan özet (DOG-131): sayılar bu sayfanın zaten gösterdiği veriden.
  const visibleLanguages = (result.languageChecks ?? []).filter((c) => c.status !== "absent" && !result.excluded?.includes(c.index))
  const navItems = resultNav({
    requirements: exclusion.active,
    titleMissing: result.titleMatch && (result.scoringRevision ?? 1) >= 2 ? result.titleMatch.level === "none" : null,
    formatFindings: format ? format.findings.length : null,
    conditionsToCheck:
      exclusion.conditionRows.filter(({ item }) => item.status !== "matched").length + visibleLanguages.filter((c) => c.status !== "ok").length,
    missingKeywords: exclusion.missingKeywords.length,
  })
  const goTo = (item: ResultNavItem) => {
    setTab("report")
    if (item.filterMissing) setFilter("missing")
    document.getElementById(item.target)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
  }
  const satisfiedCount = summary.matched
  const correctedCount = Object.keys(result.corrections ?? {}).length
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
    <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-6">
    <ResultNavPanel score={exclusion.score} items={navItems} onSelect={goTo} />
    <section className="space-y-6">
      <ResultNavStrip items={navItems} onSelect={goTo} />
      <div className="flex flex-wrap items-center justify-between gap-3">
      {postingText && (
        <div role="tablist" aria-label="Sonuç görünümü" className="inline-flex rounded-button bg-background p-1 text-sm">
          {(
            [
              ["report", "Rapor"],
              ["posting", "İlan metni"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "rounded-[8px] px-4 py-1.5 font-semibold transition",
                tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <ResultGuide
        impacts={impacts}
        onGo={(target) => {
          setTab("report")
          // Rapor sekmesi görünür olduktan sonra kaydır.
          requestAnimationFrame(() =>
            document.getElementById(target)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }),
          )
        }}
      />
      </div>
      {postingText && tab === "posting" && (
        <PostingTextView text={postingText} highlight={highlight} onClear={() => setHighlight(null)} />
      )}
      <div className={cn("space-y-6", tab === "posting" && "hidden")}>
      {/* Skor kartı. */}
      <motion.div
        {...entrance(0)}
        id="skor"
        className="relative scroll-mt-24 overflow-hidden rounded-card border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-blue/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <ScoreRing score={exclusion.score} size={148} className="shrink-0 self-center sm:self-auto" />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Uyum skoru</p>
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
            {ready && (
              <p
                className={`mt-1.5 flex gap-1.5 text-sm font-medium ${ready.ready ? "text-brand-green dark:text-[#4ade80]" : "text-foreground"}`}
              >
                {ready.ready ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <Target className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
                )}
                <span>{readinessHint(ready)}</span>
              </p>
            )}
            {result.titleMatch && (result.scoringRevision ?? 1) >= 2 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {TITLE_LINE[result.titleMatch.level]} ({result.titleMatch.position}); unvan skora bir zorunlu gereksinim
                gibi katılıyor.
              </p>
            )}
            {(result.facts?.length ?? 0) > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Daha önce anlattığın {result.facts!.length} deneyim bu analizde kanıt sayıldı; Hesabım&apos;dan
                görebilir, unutabilirsin.
              </p>
            )}
            {(exclusion.excludedCount > 0 || correctedCount > 0) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {exclusion.excludedCount > 0 && `İşaretlediğin ${exclusion.excludedCount} gereksinim skora katılmıyor. `}
                {correctedCount > 0 && `İlanın ${correctedCount} şartını düzelttin. `}
                İlk skor {result.score}.
              </p>
            )}
            {/* K2'de iki katılımcı düşük skoru "işe uygun değilim" diye okudu
                (DOG-103). Skor CV ile ilanın örtüşmesi; çerçeve bunu söylüyor. */}
            <p className="mt-2 text-sm text-muted-foreground">
              {missing > 0
                ? "Bu skor CV'nin ilanla ne kadar örtüştüğünü ölçer, işe uygunluğunu değil. Eksiklerden deneyiminde olanları CV'nde görünür kılarsan skor yükselir. Uyarladığımızda bunu deneyiminin izin verdiği ölçüde yapıyoruz; olmayan bir şeyi eklemiyoruz."
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
            {onAdapt && adaptNote && <p className="mt-2 text-sm text-muted-foreground">{adaptNote}</p>}

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

      {sourceWarning && (
        <motion.p
          {...entrance(0.05)}
          role={sourceWarning.tone === "strong" ? "alert" : undefined}
          className={cn(
            "m-0 flex gap-2 rounded-card border p-4 text-sm",
            sourceWarning.tone === "strong" ? "border-brand-red/30 bg-brand-red/[0.06]" : "border-border bg-card text-muted-foreground",
          )}
        >
          <ShieldAlert
            className={cn("mt-0.5 size-4 shrink-0", sourceWarning.tone === "strong" ? "text-brand-red" : "text-brand-amber")}
            aria-hidden
          />
          <span>{sourceWarning.text}</span>
        </motion.p>
      )}

      {platform && (
        <motion.div {...entrance(0.06)}>
          <PlatformTips platform={platform} />
        </motion.div>
      )}

      {format && (
        <motion.div {...entrance(0.08)} id="bicim" className="scroll-mt-24">
          <FormatReport
            report={format}
            impact={impacts.format}
            titleImpact={impacts.title}
            titleAction={
              onPositionChange && result.titleMatch ? (
                <TitleCorrection position={result.titleMatch.position} onSave={onPositionChange} />
              ) : undefined
            }
          />
          {result.positionCorrection && (
            <PositionCorrectionNote position={result.positionCorrection} onUndo={onPositionChange ? () => onPositionChange(null) : undefined} />
          )}
        </motion.div>
      )}

      <ConditionsCard
        conditions={exclusion.conditionRows.map(({ item }) => item)}
        // Dil CV'de hiç yoksa gereksinim listesinde zaten eksik görünüyor.
        languages={visibleLanguages}
        impact={impacts.conditions}
        motionProps={entrance(0.11)}
      />

      {/* Gereksinimler. */}
      <motion.div {...entrance(0.14)} id="gereksinimler" className="scroll-mt-24 rounded-card border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-lg">
              Gereksinimler <ImpactBadge impact={impacts.requirements} className="ml-1" />
            </h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">{impacts.requirements.hint}</p>
          </div>
          <div role="tablist" aria-label="Gereksinimleri süz" className="inline-flex rounded-button bg-background p-1 text-sm">
            {(
              [
                ["all", `Hepsi · ${exclusion.rows.length}`],
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
                  activeFilter === val ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Bu süzgeçte gereksinim yok.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {visible.map(({ item, index, excluded }) => (
              <RequirementRow
                key={`${activeFilter}-${index}`}
                item={item}
                excluded={excluded}
                mark={result.exclusions?.[index]}
                reported={result.reports?.some((r) => r.index === index) ?? false}
                correction={result.corrections?.[index]}
                onChange={onRequirementChange ? (change) => onRequirementChange(index, change) : undefined}
                onShowInPosting={postingText ? () => showInPosting(item) : undefined}
              />
            ))}
          </ul>
        )}
      </motion.div>

      {/* Kişisel nitelikler (DOG-103): skora katılmıyor, eksik sayılmıyor. */}
      {exclusion.softRows.length > 0 && (
        <motion.div {...entrance(0.17)} className="rounded-card border border-border bg-card p-5 sm:p-6">
          <h2 className="m-0 text-lg">
            Mülakatta anlaşılacaklar {impacts.soft && <ImpactBadge impact={impacts.soft} className="ml-1" />}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu kişisel nitelikler CV&apos;den değil görüşmede anlaşılır; skora katılmıyor ve eksik sayılmıyor.
            Deneyimlerinde örneği varsa mülakatta anlatmaya hazırlan.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {exclusion.softRows.map(({ item, index }) => (
              <li key={index} className="flex items-start gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span className="min-w-0">
                  {item.requirement.text}
                  {item.status === "matched" && item.evidence && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {item.evidence.fact ? "Anlattığın deneyimde" : "CV'nde"}: {item.evidence.text}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Eksik kavramlar. */}
      <motion.div {...entrance(0.2)} id="kavramlar" className="scroll-mt-24 rounded-card border border-border bg-card p-5 sm:p-6">
        <h2 className="m-0 text-lg">CV&apos;nde görünmeyen kavramlar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          İlanda geçen ama CV&apos;nde karşılığını bulamadığımız kavramlar. Deneyiminde varsa açıkça yazmak skoru
          yükseltir.
        </p>
        {exclusion.missingKeywords.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">İlanın her kavramı CV&apos;nde görünüyor.</p>
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
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted-foreground">
          Teknik ayrıntı
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre className="mt-2 max-h-[32rem] overflow-x-auto rounded-button border border-border bg-background p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
      </div>
    </section>
    </div>
  )
}

function RequirementRow({
  item,
  excluded = false,
  mark,
  reported,
  correction,
  onChange,
  onShowInPosting,
}: {
  item: RequirementResult
  /** İlan metni sekmesinde bu gereksinimin terimlerini vurgular (DOG-133). */
  onShowInPosting?: () => void
  excluded?: boolean
  mark?: ExclusionMark
  reported: boolean
  correction?: RequirementCorrection
  onChange?: (change: RequirementAction) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState<"mark" | "correct" | null>(null)
  const [saving, setSaving] = useState(false)
  const send = async (change: RequirementAction) => {
    if (!onChange) return
    setSaving(true)
    try {
      await onChange(change)
      setPanel(null)
    } catch {
      // Hata üstte gösteriliyor; panel açık kalsın, kullanıcı tekrar denesin.
    } finally {
      setSaving(false)
    }
  }
  const kind = correctionKind(item.requirement.type)
  const done = item.status === "matched"
  // Eksik yıl ve bölüm şartında düzeltme satırda hep görünür (DOG-134):
  // yanlış okunmuş "5 yıl" ya da bölüm adı en sık düzeltilen şey.
  const inlineFix =
    !done &&
    !!onChange &&
    (kind === "terms" || (kind === "years" && (item.requirement.minYears ?? requiredYears(item.requirement.text)) != null))
  const partial = isPartial(item)
  const importanceLabel = IMPORTANCE_LABEL[item.requirement.importance] ?? item.requirement.importance

  if (excluded) {
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-muted-foreground">
        <span className="min-w-0 flex-1 line-through decoration-muted-foreground/60">{item.requirement.text}</span>
        <span className="text-xs">{exclusionLabel(mark)} · skora katılmıyor</span>
        {onChange && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void send({ action: "include" })}
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
              : // Kırmızı "başarısız" okunuyordu (DOG-103); eksik, kapatılabilecek bir şey.
                "bg-brand-amber/10 text-brand-amber",
          )}
        >
          {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
          <span className="sr-only">{partial ? "Kısmen karşılanıyor" : done ? "Karşılanıyor" : "CV'nde görünmüyor"}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{item.requirement.text}</span>
          <span className="ml-2 inline-block rounded-full bg-background px-2 py-0.5 align-middle text-[11px] font-semibold text-muted-foreground">
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
            className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
      {item.evidence && open && (
        <p className="mt-2 ml-8 rounded-button border-l-2 border-brand-green/60 bg-background px-3 py-2 text-sm text-muted-foreground">
          {item.evidence.fact ? (
            <>
              <span className="font-semibold text-foreground">Daha önce anlattığın deneyimde:</span> {item.evidence.text}{" "}
              (Yüklediğin CV&apos;de yok; uyarladığın CV&apos;ye eklenir.)
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">CV&apos;nde bunu karşılayan:</span> {item.evidence.text}
            </>
          )}
        </p>
      )}
      {correction && (
        <p className="mt-1 ml-8 text-xs text-muted-foreground">
          Şartı düzelttin:{" "}
          {correction.minYears !== undefined && `en az ${correction.minYears} yıl`}
          {correction.terms && correction.terms.join(", ")}
        </p>
      )}
      {reported && (
        <p className="mt-1 ml-8 text-xs text-muted-foreground">
          Bildirdin, teşekkürler. Bu ifadeyi CV&apos;nde ilanın kelimeleriyle yazarsan ATS de bulur.
        </p>
      )}
      {/* Kavram ayırma bazen ilanda olmayan bir şart üretiyor; kullanıcı
          düzeltebilsin, işaret de bize hata verisi olsun (DOG-90). */}
      {(onChange || onShowInPosting) && panel === null && (
        <div
          className={cn(
            "mt-1 ml-8 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground",
            !inlineFix && "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100",
          )}
        >
          {onShowInPosting && (
            <button type="button" onClick={onShowInPosting} className="underline-offset-2 hover:text-foreground hover:underline">
              İlanda göster
            </button>
          )}
          {onChange && (
          <button type="button" onClick={() => setPanel("mark")} className="underline-offset-2 hover:text-foreground hover:underline">
            Bu şartta sorun var
          </button>
          )}
          {onChange && kind && (
            <button
              type="button"
              onClick={() => setPanel("correct")}
              className={cn("underline-offset-2 hover:underline", inlineFix ? "font-semibold text-brand-blue" : "hover:text-foreground")}
            >
              {correction
                ? "Düzeltmeyi değiştir"
                : !inlineFix
                  ? "Şartı düzelt"
                  : kind === "years"
                    ? "Yıl yanlış mı okunmuş? Düzelt"
                    : "Bölüm yanlış mı okunmuş? Düzelt"}
            </button>
          )}
        </div>
      )}
      {panel === "mark" && (
        <MarkPanel saving={saving} onCancel={() => setPanel(null)} onSubmit={(m) => void send({ action: "exclude", ...m })} />
      )}
      {panel === "correct" && kind && (
        <CorrectPanel
          kind={kind}
          initialYears={correction?.minYears ?? item.requirement.minYears}
          initialTerms={correction?.terms ?? (item.requirement.concepts ?? []).map((c) => c.term)}
          corrected={correction !== undefined}
          saving={saving}
          onCancel={() => setPanel(null)}
          onRemove={() => void send({ action: "correct", minYears: null, terms: null })}
          onSubmit={(c) => void send({ action: "correct", ...c })}
        />
      )}
    </li>
  )
}

/**
 * Şartlar (DOG-115): ilanın evet/hayır soruları ve dil seviyesi. Skora
 * katılmıyor; CV bunları çoğunlukla söylemiyor, kullanıcı başvurmadan önce
 * kendisi bakıyor. CV'de cevap veren satır varsa o satır gösteriliyor, yoksa
 * "kontrol et"; CV'ye bakarak hiçbir şart "karşılanmıyor" denmiyor.
 */
function ConditionsCard({
  conditions,
  languages,
  impact,
  motionProps,
}: {
  conditions: RequirementResult[]
  languages: LanguageCheck[]
  impact: ScoreImpact | null
  motionProps: object
}) {
  if (conditions.length === 0 && languages.length === 0) return null
  return (
    <motion.div {...motionProps} id="sartlar" className="scroll-mt-24 rounded-card border border-border bg-card p-5 sm:p-6">
      <h2 className="m-0 text-lg">Şartlar {impact && <ImpactBadge impact={impact} className="ml-1" />}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        İlanın yetkinlik dışındaki şartları. Skora katılmıyor; CV&apos;n çoğunu söylemez, başvurmadan önce kendin
        kontrol et.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {conditions.map((item, i) => (
          <ConditionLine
            key={`c${i}`}
            ok={item.status === "matched"}
            text={item.requirement.text}
            note={item.status === "matched" && item.evidence ? `CV'nde: ${item.evidence.text}` : "Kontrol et"}
          />
        ))}
        {languages.map((check) => (
          <ConditionLine
            key={`l${check.index}`}
            ok={check.status === "ok"}
            text={`${check.language}: ilan ${check.required} seviyesi istiyor`}
            note={
              check.status === "unknown"
                ? `CV'nde seviye yazmıyor (${check.cvLine})`
                : check.status === "below"
                  ? `CV'nde ${check.found} yazıyor (${check.cvLine}); ilanın istediğinin altında`
                  : `CV'nde ${check.found} (${check.cvLine})`
            }
          />
        ))}
      </ul>
    </motion.div>
  )
}

function ConditionLine({ ok, text, note }: { ok: boolean; text: string; note: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-brand-green" aria-label="CV'nde görünüyor" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-brand-coral" aria-label="Kontrol et" />
      )}
      <span className="min-w-0">
        {text}
        <span className="text-muted-foreground"> · {note}</span>
      </span>
    </li>
  )
}

/** Geniş ekranda yapışkan özet (DOG-131): skor ve kategori satırları. */
function ResultNavPanel({ score, items, onSelect }: { score: number; items: ResultNavItem[]; onSelect: (i: ResultNavItem) => void }) {
  const state = scoreStatus(score)
  return (
    <aside aria-label="Sonuç özeti" className="sticky top-24 hidden rounded-card border border-border bg-card p-4 lg:block">
      <p className="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Uyum skoru</p>
      <p className={cn("m-0 mt-1 font-heading text-3xl font-extrabold", state.textClass)}>{score}</p>
      <p className="m-0 text-xs text-muted-foreground">{state.label}</p>
      <ul className="m-0 mt-4 list-none space-y-3 p-0">
        {items.map((item) => (
          <li key={item.key}>
            <button type="button" onClick={() => onSelect(item)} className="w-full text-left text-sm">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{item.label}</span>
                <span className={cn("shrink-0 text-xs", item.issues === 0 ? "text-brand-green dark:text-[#4ade80]" : "text-brand-blue")}>
                  {navStatus(item)}
                </span>
              </span>
              {item.progress && (
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-brand-blue"
                    style={{ width: `${item.progress.total ? (item.progress.done / item.progress.total) * 100 : 0}%` }}
                  />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** Dar ekranda aynı satırlar, sayfanın üstünde kaydırılabilir şerit. */
function ResultNavStrip({ items, onSelect }: { items: ResultNavItem[]; onSelect: (i: ResultNavItem) => void }) {
  return (
    <nav aria-label="Sonuç bölümleri" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item)}
          className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs whitespace-nowrap"
        >
          {item.label} · <span className={item.issues === 0 ? "text-brand-green dark:text-[#4ade80]" : "text-brand-blue"}>{navStatus(item)}</span>
        </button>
      ))}
    </nav>
  )
}

/**
 * İlan metni sekmesi (DOG-133). "İlanda göster" ile gelindiyse gereksinimin
 * kavramları ve eş anlamlıları vurgulu; eşleşme skorlamayla aynı kural.
 */
function PostingTextView({
  text,
  highlight,
  onClear,
}: {
  text: string
  highlight: { label: string; terms: string[] } | null
  onClear: () => void
}) {
  const reducedMotion = useReducedMotion()
  const firstMark = useRef<HTMLElement>(null)
  // Uzun ilanda ilk vurgu ekranın altında kalmasın; vurgu yoksa sekmenin başına.
  useEffect(() => {
    if (!highlight) return
    const behavior = reducedMotion ? "auto" : "smooth"
    if (firstMark.current) firstMark.current.scrollIntoView({ block: "center", behavior })
    else window.scrollTo({ top: 0, behavior })
  }, [highlight, reducedMotion])
  const spans = highlight ? keywordSpans(text, highlight.terms) : []
  const parts: Array<{ text: string; mark: boolean }> = []
  let at = 0
  for (const s of spans) {
    if (s.start > at) parts.push({ text: text.slice(at, s.start), mark: false })
    parts.push({ text: text.slice(s.start, s.end), mark: true })
    at = s.end
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: false })
  return (
    <div className="rounded-card border border-border bg-card p-5 sm:p-6">
      {highlight && (
        <p className="m-0 mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Vurgulanan: <span className="font-medium text-foreground">{highlight.label}</span>
            {spans.length === 0 && " · ilan metninde bu kelimelerle geçmiyor; çıkarım ilanı farklı ifade etmiş olabilir."}
          </span>
          <button type="button" onClick={onClear} className="text-xs font-semibold text-brand-blue">
            Vurguyu kaldır
          </button>
        </p>
      )}
      <p className="m-0 text-sm leading-relaxed whitespace-pre-line">
        {parts.map((p, i) =>
          p.mark ? (
            <mark
              key={i}
              ref={parts.findIndex((x) => x.mark) === i ? firstMark : undefined}
              className="rounded bg-brand-blue/25 px-0.5 font-medium text-foreground ring-1 ring-brand-blue/40"
            >
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
    </div>
  )
}

/** Unvan düzeltildiyse (DOG-134): bulgu eşleşince kaybolsa da geri alınabilsin. */
function PositionCorrectionNote({ position, onUndo }: { position: string; onUndo?: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  return (
    <p className="m-0 mt-2 px-1 text-xs text-muted-foreground">
      İlanın unvanını “{position}” olarak düzelttin; unvan eşleşmesi ve skor buna göre.{" "}
      {onUndo && (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true)
            onUndo().catch(() => {}).finally(() => setSaving(false))
          }}
          className="font-semibold text-brand-blue underline-offset-2 hover:underline disabled:opacity-50"
        >
          {saving ? "Geri alınıyor…" : "Geri al"}
        </button>
      )}
    </p>
  )
}
