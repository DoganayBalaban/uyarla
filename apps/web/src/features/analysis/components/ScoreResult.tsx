"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { Check, CircleAlert, Ellipsis, LoaderCircle, ShieldAlert, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/cn"
import { FormatReportCard as FormatReport, type FormatReportView } from "@/features/analysis/components/FormatReport"
import { TitleCorrection } from "@/features/analysis/components/TitleCorrection"
import { ResultGuide } from "@/features/analysis/components/ResultGuide"
import { scoreImpacts } from "@/features/analysis/scoreImpact"
import type { Declaration, DeclareTarget } from "@uyarla/core/adapt/declarations"
import { ScoreBreakdown } from "@/features/analysis/components/ScoreBreakdown"
import { scoreParts, type ScorePart } from "@/features/analysis/scoreParts"
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
import { correctionKind, exclusionLabel, requirementMenu } from "@/features/analysis/requirementFix"
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
  /**
   * `fact`: kanıt daha önce anlatılan bir deneyimden (DOG-116), yüklenen CV'de
   * yok. `declared`: aday bu analizde ekledi (K-114), o da CV'de yok.
   */
  evidence: { text: string; kind: string; fact?: boolean; declared?: boolean } | null
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
  /** "Bende var" beyanları (K-114): yalnızca bu analizde. */
  declarations?: Declaration[]
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

type FilterBar = "all" | "missing" | "satisfied"

const IMPORTANCE_LABEL: Record<string, string> = {
  must: "Zorunlu",
  nice: "Tercih sebebi",
}

/**
 * Analiz sonucunun gösterimi.
 *
 * Üstte skor (rehber §9.5: skor ekranın en büyük öğesi) ve skoru oluşturan
 * parçalar: CV'de olanlar ve olmayanlar. Altında gereksinimler iki sütunlu
 * defter gibi: solda ilanın istediği, sağda CV'deki karşılığı ya da
 * karşılanırsa kaç puan getireceği. Sonra eksik kavramlar, şartlar, CV
 * kontrolü ve kişisel nitelikler. Kartlar yerine çizgiyle ayrılan bölümler.
 */
export function ScoreResult({
  result,
  adapting,
  error,
  onAdapt,
  adaptNote,
  onRequirementChange,
  declareContext,
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
  adapting: boolean
  error?: string | null
  onAdapt?: () => void
  /** Uyarla düğmesinin altında: bu uyarlamanın neyi harcayacağı (DOG-81). */
  adaptNote?: string | null
  /** Gereksinimi işaretler, işareti kaldırır ya da şartını düzeltir (DOG-90); yoksa düğmeler çıkmıyor. */
  onRequirementChange?: (requirementIndex: number, change: RequirementAction) => Promise<void>
  /** İlan unvanını düzeltir (DOG-134); null düzeltmeyi kaldırıyor. */
  onPositionChange?: (position: string | null) => Promise<void>
  /** "Bende var" için (K-114); yoksa düğme çıkmıyor. */
  declareContext?: { locked: boolean; targets: DeclareTarget[] }
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
  const state = scoreStatus(exclusion.score, result.scoringRevision ?? 1)
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

  // Skorun parçaları: formülle aynı toplamı veriyorsa çiziliyor.
  const parts = scoreParts({
    requirements: result.requirements,
    excluded: result.excluded,
    titleMatch: result.titleMatch,
    scoringRevision: result.scoringRevision,
  })
  const visibleParts = parts.score === exclusion.score ? parts.parts : []
  const gains = new Map(visibleParts.flatMap((p) => (p.index === null ? [] : [[p.index, p.gain] as const])))
  // Parçalardan seçilen gereksinim listede kısa bir an vurgulanıyor.
  const [flash, setFlash] = useState<number | null>(null)
  const selectPart = (part: ScorePart) => {
    setTab("report")
    if (part.index === null) {
      document.getElementById("bicim")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
      return
    }
    setFilter("all")
    setFlash(part.index)
    window.setTimeout(() => setFlash((f) => (f === part.index ? null : f)), 1800)
    requestAnimationFrame(() =>
      document
        .getElementById(`gereksinim-${part.index}`)
        ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }),
    )
  }

  const report = (
    <div>
      {/* Skor: rakam, tek cümle ve skoru oluşturan parçalar. */}
      <header id="skor" className="scroll-mt-20 pt-6 pb-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-10">
          <div className="shrink-0">
            <p className="m-0 text-[6.5rem] leading-[0.78] font-semibold tracking-[-0.065em] tabular-nums sm:text-[8.5rem]">
              {exclusion.score}
            </p>
            <p className="m-0 mt-4 flex items-center gap-2 text-sm font-medium">
              <span aria-hidden className={cn("size-2 rounded-full bg-current", state.textClass)} />
              {state.label}
            </p>
          </div>
          <div className="min-w-0 flex-1 sm:pb-7">
            <h1 className="m-0 max-w-[24ch] text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[2rem]">
              İlanın {exclusion.active.length} gereksiniminden {satisfiedCount} tanesi CV&apos;nde var.
            </h1>
            {/* Zorunlular ayrıca: işe alımcının ilk baktığı yer (DOG-66). Sayının
                ardından ek getirmiyoruz; "5'i / 6'sı" sayıya göre değişiyor. */}
            {(summary.mustTotal > 0 || summary.partial > 0) && (
              <p className="m-0 mt-2 text-sm text-muted-foreground">
                {summary.mustTotal > 0 && <>Zorunlu gereksinimler: {summary.mustMatched} / {summary.mustTotal}</>}
                {summary.mustTotal > 0 && summary.partial > 0 && ". "}
                {partialNote(summary)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-9">
          <ScoreBreakdown
            parts={visibleParts}
            onSelect={selectPart}
            declare={
              onRequirementChange && declareContext
                ? { ...declareContext, declarations: result.declarations ?? [], onChange: onRequirementChange }
                : undefined
            }
          />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0 max-w-prose">
            {ready && (
              <p
                className={cn(
                  "m-0 border-l-2 pl-4 text-base leading-relaxed",
                  ready.ready ? "border-brand-green" : "border-brand-amber",
                )}
              >
                {readinessHint(ready)}
              </p>
            )}
            {/* K2'de iki katılımcı düşük skoru "işe uygun değilim" diye okudu
                (DOG-103). Skor CV ile ilanın örtüşmesi; çerçeve bunu söylüyor. */}
            <p className="m-0 mt-3 text-sm text-muted-foreground">
              {missing > 0
                ? "Bu skor CV'nin ilanla ne kadar örtüştüğünü ölçer, işe uygunluğunu değil. Uyarladığımızda eksikleri deneyiminin izin verdiği ölçüde görünür kılıyoruz; senin eklediklerin dışında olmayan bir şey eklemiyoruz."
                : "CV'n bu ilanın istediklerini karşılıyor. Yine de anlatımı ilanın diline yaklaştırabilirsin."}
            </p>
            {(result.facts?.length ?? 0) > 0 && (
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                Daha önce anlattığın {result.facts!.length} deneyim bu analizde kanıt sayıldı; CV&apos;lerim&apos;den
                görebilir, unutabilirsin.
              </p>
            )}
            {(exclusion.excludedCount > 0 || correctedCount > 0) && (
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                {exclusion.excludedCount > 0 && `İşaretlediğin ${exclusion.excludedCount} gereksinim skora katılmıyor. `}
                {correctedCount > 0 && `İlanın ${correctedCount} şartını düzelttin. `}
                İlk skor {result.score}.
              </p>
            )}
          </div>
          {onAdapt && (
            <div className="md:text-right">
              <Button size="lg" disabled={adapting} onClick={onAdapt}>
                {adapting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {adapting ? "Hazırlanıyor…" : "CV'mi bu ilana uyarla"}
              </Button>
              {adaptNote && <p className="m-0 mt-2 max-w-xs text-sm text-muted-foreground md:ml-auto">{adaptNote}</p>}
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <CircleAlert aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </header>

      <div className="space-y-4">
        {sourceWarning && (
          <Alert
            role={sourceWarning.tone === "strong" ? "alert" : "status"}
            className={cn(sourceWarning.tone === "strong" ? "border-brand-red/30 bg-brand-red/[0.06]" : "text-muted-foreground")}
          >
            <ShieldAlert className={sourceWarning.tone === "strong" ? "text-brand-red" : "text-brand-amber"} aria-hidden />
            <AlertDescription className={sourceWarning.tone === "strong" ? "text-foreground" : undefined}>{sourceWarning.text}</AlertDescription>
          </Alert>
        )}
        {platform && <PlatformTips platform={platform} />}
      </div>

      {/* Gereksinimler: solda ilanın istediği, sağda CV'deki karşılığı. */}
      <section id="gereksinimler" className="scroll-mt-20 border-t pt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-semibold tracking-tight">Gereksinimler</h2>
            <p className="m-0 mt-1 text-sm text-muted-foreground">{impacts.requirements.hint}</p>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={activeFilter}
            onValueChange={(v) => v && setFilter(v as FilterBar)}
            aria-label="Gereksinimleri süz"
          >
            {(
              [
                ["all", `Hepsi ${exclusion.rows.length}`],
                ["missing", `Eksik ${missing}`],
                ["satisfied", `Karşılanan ${satisfiedCount}`],
              ] as const
            ).map(([val, label]) => (
              <ToggleGroupItem key={val} value={val} className="px-3">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {visible.length === 0 ? (
          <p className="m-0 mt-6 text-sm text-muted-foreground">Bu süzgeçte gereksinim yok.</p>
        ) : (
          <>
            <div aria-hidden className="mt-6 hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.75rem] gap-x-8 border-b pb-2 text-xs text-muted-foreground md:grid">
              <span className="pl-8">İlan istiyor</span>
              <span>CV&apos;nde</span>
            </div>
            <ul className="m-0 list-none divide-y p-0 max-md:mt-4 max-md:border-t">
              {visible.map(({ item, index, excluded }) => (
                <RequirementRow
                  key={`${activeFilter}-${index}`}
                  index={index}
                  item={item}
                  gain={gains.get(index) ?? 0}
                  flash={flash === index}
                  excluded={excluded}
                  mark={result.exclusions?.[index]}
                  reported={result.reports?.some((r) => r.index === index) ?? false}
                  correction={result.corrections?.[index]}
                  onChange={onRequirementChange ? (change) => onRequirementChange(index, change) : undefined}
                  onShowInPosting={postingText ? () => showInPosting(item) : undefined}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Eksik kavramlar: gereksinimlerin hemen ardından, aynı eksiklerin kelimeleri. */}
      <section id="kavramlar" className="mt-12 scroll-mt-20 border-t pt-8">
        <h2 className="m-0 text-lg font-semibold tracking-tight">CV&apos;nde görünmeyen kavramlar</h2>
        <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
          İlanda geçen ama CV&apos;nde karşılığını bulamadığımız kelimeler. Deneyiminde varsa ilanın kelimesiyle yazmak
          skoru yükseltir.
        </p>
        {exclusion.missingKeywords.length === 0 ? (
          <p className="m-0 mt-4 text-sm text-muted-foreground">İlanın her kavramı CV&apos;nde görünüyor.</p>
        ) : (
          <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
            {exclusion.missingKeywords.map((k) => (
              <li key={k} className="rounded-md border border-dashed px-2.5 py-1 text-sm">
                {k}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConditionsSection
        conditions={exclusion.conditionRows.map(({ item }) => item)}
        // Dil CV'de hiç yoksa gereksinim listesinde zaten eksik görünüyor.
        languages={visibleLanguages}
      />

      {format && (
        <div id="bicim" className="mt-12 scroll-mt-20">
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
        </div>
      )}

      {/* Kişisel nitelikler (DOG-103): skora katılmıyor, eksik sayılmıyor. */}
      {exclusion.softRows.length > 0 && (
        <section className="mt-12 border-t pt-8">
          <h2 className="m-0 text-lg font-semibold tracking-tight">Mülakatta anlaşılacaklar</h2>
          <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
            Bu kişisel nitelikler CV&apos;den değil görüşmede anlaşılır; skora katılmıyor ve eksik sayılmıyor.
            Deneyimlerinde örneği varsa mülakatta anlatmaya hazırlan.
          </p>
          <ul className="m-0 mt-4 list-none space-y-2 p-0 text-sm">
            {exclusion.softRows.map(({ item, index }) => (
              <li key={index} className="flex items-start gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span className="min-w-0">
                  {item.requirement.text}
                  {item.status === "matched" && item.evidence && (
                    <span className="block text-muted-foreground">
                      {item.evidence.declared ? "Sen ekledin" : item.evidence.fact ? "Anlattığın deneyimde" : "CV'nde"}: {item.evidence.text}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )

  const guide = (
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
  )

  return (
    <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-12">
      <ResultNavPanel items={navItems} onSelect={goTo} />
      <section className="min-w-0 space-y-4">
        <ResultNavStrip items={navItems} onSelect={goTo} />
        {postingText ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "report" | "posting")} className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList aria-label="Sonuç görünümü">
                <TabsTrigger value="report" className="px-4">
                  Rapor
                </TabsTrigger>
                <TabsTrigger value="posting" className="px-4">
                  İlan metni
                </TabsTrigger>
              </TabsList>
              {guide}
            </div>
            {/* Rapor gizlenince kaybolmasın: süzgeç ve açık satırlar korunuyor. */}
            <TabsContent value="report" forceMount className="data-[state=inactive]:hidden">
              {report}
            </TabsContent>
            <TabsContent value="posting">
              <PostingTextView text={postingText} highlight={highlight} onClear={() => setHighlight(null)} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <div className="flex justify-end">{guide}</div>
            {report}
          </>
        )}
      </section>
    </div>
  )
}

function RequirementRow({
  index,
  item,
  gain,
  flash = false,
  excluded = false,
  mark,
  reported,
  correction,
  onChange,
  onShowInPosting,
}: {
  index: number
  item: RequirementResult
  /** Tamamen karşılanırsa skora eklenecek puan (skorun parçalarıyla aynı hesap). */
  gain: number
  /** Skorun parçalarından seçildi: kısa bir an vurgulu. */
  flash?: boolean
  /** İlan metni sekmesinde bu gereksinimin terimlerini vurgular (DOG-133). */
  onShowInPosting?: () => void
  excluded?: boolean
  mark?: ExclusionMark
  reported: boolean
  correction?: RequirementCorrection
  onChange?: (change: RequirementAction) => Promise<void>
}) {
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
  const actions = requirementMenu({
    canChange: !!onChange,
    canShowInPosting: !!onShowInPosting,
    kind,
    inlineFix,
    corrected: correction !== undefined,
  })
  const partial = isPartial(item)
  const importanceLabel = IMPORTANCE_LABEL[item.requirement.importance] ?? item.requirement.importance

  if (excluded) {
    return (
      <li id={`gereksinim-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-4 pl-8 text-sm text-muted-foreground">
        <span className="min-w-0 flex-1 line-through decoration-muted-foreground/60">{item.requirement.text}</span>
        <span className="text-xs">{exclusionLabel(mark)} · skora katılmıyor</span>
        {onChange && (
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={saving}
            onClick={() => void send({ action: "include" })}
            className="h-auto px-0 text-xs"
          >
            Geri al
          </Button>
        )}
      </li>
    )
  }

  return (
    <li
      id={`gereksinim-${index}`}
      className={cn(
        "grid scroll-mt-24 grid-cols-[minmax(0,1fr)_1.75rem] gap-x-8 gap-y-2 py-4 transition-colors duration-700 [grid-template-areas:'req_menu'_'cv_cv']",
        "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.75rem] md:[grid-template-areas:'req_cv_menu']",
        flash && "bg-brand-amber/10 duration-150",
      )}
    >
      {/* İlan istiyor */}
      <div className="flex min-w-0 items-start gap-3 [grid-area:req]">
        <span
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
            done && !partial && "bg-foreground text-background",
            partial && "bg-[linear-gradient(90deg,var(--foreground)_50%,transparent_50%)] shadow-[inset_0_0_0_1.5px_var(--foreground)]",
            !done && "shadow-[inset_0_0_0_1.5px_var(--color-brand-amber)]",
          )}
        >
          {done && !partial && <Check className="size-3" strokeWidth={3} aria-hidden />}
          <span className="sr-only">{partial ? "Kısmen karşılanıyor" : done ? "Karşılanıyor" : "CV'nde görünmüyor"}</span>
        </span>
        <span className="min-w-0 text-sm">
          <span className="block font-medium">{item.requirement.text}</span>
          <span className="block text-xs text-muted-foreground">
            {importanceLabel}
            {partial && " · kısmen karşılanıyor"}
          </span>
        </span>
      </div>

      {/* CV'nde */}
      <div className="min-w-0 pl-8 text-sm [grid-area:cv] md:pl-0">
        {item.evidence ? (
          <p className="m-0 text-muted-foreground">
            <span className="line-clamp-3 text-foreground/80">{item.evidence.text}</span>
            {item.evidence.declared ? (
              <span className="mt-0.5 block text-xs">Sen ekledin; yüklediğin CV&apos;de yok, uyarladığın CV&apos;ye eklenir.</span>
            ) : item.evidence.fact ? (
              <span className="mt-0.5 block text-xs">
                Daha önce anlattığın deneyimden; yüklediğin CV&apos;de yok, uyarladığın CV&apos;ye eklenir.
              </span>
            ) : null}
          </p>
        ) : (
          <p className="m-0 text-muted-foreground">Görünmüyor</p>
        )}
        {gain > 0 && (
          <p className="m-0 mt-0.5 text-xs font-medium">
            {done ? "Tam karşılanırsa" : "Karşılanırsa"} <span className="tabular-nums">+{gain}</span> puan
          </p>
        )}
      {correction && (
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          Şartı düzelttin:{" "}
          {correction.minYears !== undefined && `en az ${correction.minYears} yıl`}
          {correction.terms && correction.terms.join(", ")}
        </p>
      )}
      {reported && (
        <p className="m-0 mt-1 text-xs text-muted-foreground">
          Bildirdin, teşekkürler. Bu ifadeyi CV&apos;nde ilanın kelimeleriyle yazarsan ATS de bulur.
        </p>
      )}
      {/* Kavram ayırma bazen ilanda olmayan bir şart üretiyor; kullanıcı
          düzeltebilsin, işaret de bize hata verisi olsun (DOG-90). */}
      {actions.inline && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setPanel("correct")}
          className="mt-0.5 h-auto px-0 text-xs"
        >
          {actions.inline}
        </Button>
      )}
      </div>

      <div className="[grid-area:menu]">
        {actions.menu.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="-my-1 size-7 shrink-0 text-muted-foreground" aria-label="Gereksinim işlemleri">
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {actions.menu.map((a) => (
                <DropdownMenuItem
                  key={a.key}
                  onSelect={() => (a.key === "show" ? onShowInPosting?.() : setPanel(a.key))}
                >
                  {a.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <Dialog open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{panel === "mark" ? "Bu şartta ne sorun var?" : "İlanı yanlış mı okuduk?"}</DialogTitle>
            <DialogDescription>{item.requirement.text}</DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </li>
  )
}

/**
 * Şartlar (DOG-115): ilanın evet/hayır soruları ve dil seviyesi. Skora
 * katılmıyor; CV bunları çoğunlukla söylemiyor, kullanıcı başvurmadan önce
 * kendisi bakıyor. CV'de cevap veren satır varsa o satır gösteriliyor, yoksa
 * "kontrol et"; CV'ye bakarak hiçbir şart "karşılanmıyor" denmiyor.
 */
function ConditionsSection({ conditions, languages }: { conditions: RequirementResult[]; languages: LanguageCheck[] }) {
  if (conditions.length === 0 && languages.length === 0) return null
  return (
    <section id="sartlar" className="mt-12 scroll-mt-20 border-t pt-8">
      <h2 className="m-0 text-lg font-semibold tracking-tight">Şartlar</h2>
      <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
        İlanın yetkinlik dışındaki şartları. Skora katılmıyor; CV&apos;n çoğunu söylemez, başvurmadan önce kendin kontrol
        et.
      </p>
      <ul className="m-0 mt-4 list-none space-y-2.5 p-0 text-sm">
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
    </section>
  )
}

function ConditionLine({ ok, text, note }: { ok: boolean; text: string; note: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check className="mt-0.5 size-4 shrink-0" aria-label="CV'nde görünüyor" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-label="Kontrol et" />
      )}
      <span className="min-w-0">
        {text}
        <span className="block text-muted-foreground">{note}</span>
      </span>
    </li>
  )
}

/** Geniş ekranda yapışkan içindekiler (DOG-131); skor üstte büyük, burada tekrar edilmiyor. */
function ResultNavPanel({ items, onSelect }: { items: ResultNavItem[]; onSelect: (i: ResultNavItem) => void }) {
  return (
    <aside aria-label="Sonuç özeti" className="sticky top-20 hidden lg:block">
      <ul className="m-0 list-none space-y-1 border-l p-0">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="-ml-px w-full border-l border-transparent py-1.5 pr-2 pl-3 text-left text-sm transition-colors hover:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={item.issues === 0 ? "text-muted-foreground" : "font-medium"}>{item.label}</span>
                <span className={cn("shrink-0 text-xs tabular-nums", item.issues === 0 ? "text-muted-foreground" : "text-foreground")}>
                  {navStatus(item)}
                </span>
              </span>
              {item.progress && (
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-foreground"
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
    <nav aria-label="Sonuç bölümleri" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <Button
          key={item.key}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(item)}
          className="shrink-0 rounded-full text-xs whitespace-nowrap"
        >
          {item.label} · <span className={item.issues === 0 ? "text-muted-foreground" : "text-foreground"}>{navStatus(item)}</span>
        </Button>
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
    <div className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      {highlight && (
        <p className="m-0 mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Vurgulanan: <span className="font-medium text-foreground">{highlight.label}</span>
            {spans.length === 0 && " · ilan metninde bu kelimelerle geçmiyor; çıkarım ilanı farklı ifade etmiş olabilir."}
          </span>
          <Button type="button" variant="link" size="sm" onClick={onClear} className="h-auto px-0 text-xs">
            Vurguyu kaldır
          </Button>
        </p>
      )}
      <p className="m-0 text-sm leading-relaxed whitespace-pre-line">
        {parts.map((p, i) =>
          p.mark ? (
            <mark
              key={i}
              ref={parts.findIndex((x) => x.mark) === i ? firstMark : undefined}
              className="rounded bg-primary/20 px-0.5 font-medium text-foreground ring-1 ring-primary/40"
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
          className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          {saving ? "Geri alınıyor…" : "Geri al"}
        </button>
      )}
    </p>
  )
}
