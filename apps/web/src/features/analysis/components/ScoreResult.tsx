"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Ellipsis,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  const entrance = (delayMs: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: delayMs, ease: [0.22, 1, 0.36, 1] as const },
        }

  const report = (
    <div className="space-y-6">
      {/* Skor kartı. */}
      <motion.div {...entrance(0)} id="skor" className="scroll-mt-20">
        <Card className="relative overflow-hidden py-0 shadow-xs">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl" />
          <CardContent className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <ScoreRing score={exclusion.score} revision={result.scoringRevision ?? 1} size={148} className="shrink-0 self-center sm:self-auto" />

            <div className="min-w-0 flex-1">
              <p className="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Uyum skoru</p>
              <h1 className="m-0 mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {exclusion.active.length} gereksinimin <span className={state.textClass}>{satisfiedCount} tanesi</span>{" "}
                karşılanıyor
              </h1>
              {/* Zorunlular ayrıca: işe alımcının ilk baktığı yer (DOG-66). Sayının
                  ardından ek getirmiyoruz; "5'i / 6'sı" sayıya göre değişiyor. */}
              {(summary.mustTotal > 0 || summary.partial > 0) && (
                <p className="m-0 mt-1.5 text-sm font-medium text-foreground">
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
                  className={cn(
                    "m-0 mt-2 inline-flex gap-1.5 rounded-md px-2 py-1 text-sm font-medium",
                    ready.ready ? "bg-brand-green/10 text-brand-green dark:text-[#4ade80]" : "bg-brand-amber/10 text-foreground",
                  )}
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
                <p className="m-0 mt-1.5 text-sm text-muted-foreground">
                  {TITLE_LINE[result.titleMatch.level]} ({result.titleMatch.position}); unvan skora bir zorunlu gereksinim
                  gibi katılıyor.
                </p>
              )}
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
              {/* K2'de iki katılımcı düşük skoru "işe uygun değilim" diye okudu
                  (DOG-103). Skor CV ile ilanın örtüşmesi; çerçeve bunu söylüyor. */}
              <p className="m-0 mt-2 text-sm text-muted-foreground">
                {missing > 0
                  ? "Bu skor CV'nin ilanla ne kadar örtüştüğünü ölçer, işe uygunluğunu değil. Eksiklerden deneyiminde olanları CV'nde görünür kılarsan skor yükselir. Uyarladığımızda bunu deneyiminin izin verdiği ölçüde yapıyoruz; olmayan bir şeyi eklemiyoruz."
                  : "CV'n bu ilanın istediklerini karşılıyor. Yine de anlatımı ilanın diline yaklaştırabilirsin."}
              </p>

              {onAdapt && (
                <div className="mt-5">
                  <Button size="lg" disabled={adapting} onClick={onAdapt} className="group">
                    {adapting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                    {adapting ? "Hazırlanıyor…" : "CV'mi bu ilana uyarla"}
                    {!adapting && <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />}
                  </Button>
                  {adaptNote && <p className="m-0 mt-2 text-sm text-muted-foreground">{adaptNote}</p>}
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <CircleAlert aria-hidden />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {sourceWarning && (
        <motion.div {...entrance(0.05)}>
          <Alert
            role={sourceWarning.tone === "strong" ? "alert" : "status"}
            className={cn(sourceWarning.tone === "strong" ? "border-brand-red/30 bg-brand-red/[0.06]" : "text-muted-foreground")}
          >
            <ShieldAlert className={sourceWarning.tone === "strong" ? "text-brand-red" : "text-brand-amber"} aria-hidden />
            <AlertDescription className={sourceWarning.tone === "strong" ? "text-foreground" : undefined}>{sourceWarning.text}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {platform && (
        <motion.div {...entrance(0.06)}>
          <PlatformTips platform={platform} />
        </motion.div>
      )}

      {format && (
        <motion.div {...entrance(0.08)} id="bicim" className="scroll-mt-20">
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
      <motion.div {...entrance(0.14)} id="gereksinimler" className="scroll-mt-20">
        <Card className="gap-4 shadow-xs">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">
                Gereksinimler <ImpactBadge impact={impacts.requirements} className="ml-1" />
              </CardTitle>
              <CardDescription className="mt-1">{impacts.requirements.hint}</CardDescription>
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
                  ["all", `Hepsi · ${exclusion.rows.length}`],
                  ["missing", `Eksik · ${missing}`],
                  ["satisfied", `Karşılanan · ${satisfiedCount}`],
                ] as const
              ).map(([val, label]) => (
                <ToggleGroupItem key={val} value={val} className="px-3">
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            {visible.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Bu süzgeçte gereksinim yok.</p>
            ) : (
              <ul className="m-0 list-none divide-y p-0">
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Kişisel nitelikler (DOG-103): skora katılmıyor, eksik sayılmıyor. */}
      {exclusion.softRows.length > 0 && (
        <motion.div {...entrance(0.17)}>
          <Card className="gap-3 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">
                Mülakatta anlaşılacaklar {impacts.soft && <ImpactBadge impact={impacts.soft} className="ml-1" />}
              </CardTitle>
              <CardDescription>
                Bu kişisel nitelikler CV&apos;den değil görüşmede anlaşılır; skora katılmıyor ve eksik sayılmıyor.
                Deneyimlerinde örneği varsa mülakatta anlatmaya hazırlan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
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
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Eksik kavramlar. */}
      <motion.div {...entrance(0.2)} id="kavramlar" className="scroll-mt-20">
        <Card className="gap-3 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">CV&apos;nde görünmeyen kavramlar</CardTitle>
            <CardDescription>
              İlanda geçen ama CV&apos;nde karşılığını bulamadığımız kavramlar. Deneyiminde varsa açıkça yazmak skoru
              yükseltir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exclusion.missingKeywords.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">İlanın her kavramı CV&apos;nde görünüyor.</p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {exclusion.missingKeywords.map((k) => (
                  <li key={k}>
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-sm font-normal">
                      <span aria-hidden className="size-1.5 rounded-full bg-brand-coral" />
                      {k}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <details className="group rounded-xl border bg-card px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-muted-foreground">
          Teknik ayrıntı
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">
          {durationMs} ms · {tokenUsage} token · {modelId}
        </p>
        <pre className="mt-2 max-h-[32rem] overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
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
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <ResultNavPanel score={exclusion.score} revision={result.scoringRevision ?? 1} items={navItems} onSelect={goTo} />
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
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm text-muted-foreground">
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
    <li className="py-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{item.requirement.text}</span>
            <Badge variant="secondary" className="ml-2 align-middle text-[11px] text-muted-foreground">
              {importanceLabel}
            </Badge>
            {partial && <Badge className="ml-1.5 bg-brand-amber/10 align-middle text-[11px] text-brand-amber">Kısmen</Badge>}
          </span>
          {item.evidence && (
            <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} aria-hidden />
          )}
        </button>
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
      {item.evidence && open && (
        <p className="mt-2 ml-8 rounded-md border-l-2 border-brand-green/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
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
        <p className="m-0 mt-1 ml-8 text-xs text-muted-foreground">
          Şartı düzelttin:{" "}
          {correction.minYears !== undefined && `en az ${correction.minYears} yıl`}
          {correction.terms && correction.terms.join(", ")}
        </p>
      )}
      {reported && (
        <p className="m-0 mt-1 ml-8 text-xs text-muted-foreground">
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
          className="mt-0.5 ml-8 h-auto px-0 text-xs"
        >
          {actions.inline}
        </Button>
      )}
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
    <motion.div {...motionProps} id="sartlar" className="scroll-mt-20">
      <Card className="gap-3 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">Şartlar {impact && <ImpactBadge impact={impact} className="ml-1" />}</CardTitle>
          <CardDescription>
            İlanın yetkinlik dışındaki şartları. Skora katılmıyor; CV&apos;n çoğunu söylemez, başvurmadan önce kendin
            kontrol et.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
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
        </CardContent>
      </Card>
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
function ResultNavPanel({
  score,
  revision,
  items,
  onSelect,
}: {
  score: number
  revision: number
  items: ResultNavItem[]
  onSelect: (i: ResultNavItem) => void
}) {
  const state = scoreStatus(score, revision)
  return (
    <aside aria-label="Sonuç özeti" className="sticky top-20 hidden rounded-xl border bg-card p-4 shadow-xs lg:block">
      <p className="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Uyum skoru</p>
      <p className={cn("m-0 mt-1 text-3xl font-semibold tabular-nums", state.textClass)}>{score}</p>
      <p className="m-0 text-xs text-muted-foreground">{state.label}</p>
      <ul className="m-0 mt-4 list-none space-y-1 p-0">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{item.label}</span>
                <span className={cn("shrink-0 text-xs", item.issues === 0 ? "text-brand-green dark:text-[#4ade80]" : "text-primary")}>
                  {navStatus(item)}
                </span>
              </span>
              {item.progress && (
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-primary"
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
          {item.label} · <span className={item.issues === 0 ? "text-brand-green dark:text-[#4ade80]" : "text-primary"}>{navStatus(item)}</span>
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
