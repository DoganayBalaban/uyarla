"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Copy,
  FilePlus2,
  FileText,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import {
  ABOUT_TARGET_WORDS,
  HEADLINE_MAX_CHARS,
  MAX_REPORT_POSTINGS,
  type LinkedInReport,
  type LinkedInReportRecord,
  type LinkedInSuggestion,
} from "@uyarla/core/linkedin/reportRecord"
import { api, apiErrorMessage } from "@/lib/api"
import { useLibrary } from "@/features/resumes/api"
import { useApplicationCards } from "@/features/applications/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/cn"
import { StageTimeline } from "@/features/analysis/components/StageTimeline"
import { deriveStageStates } from "@/features/analysis/stageStates"

/** Raporun gerçek adımları (DOG-136); hangisinde olduğunu worker kayda yazıyor. */
const REPORT_STAGES = [
  { id: "reading", title: "Profilini okuyoruz", description: "LinkedIn PDF'indeki deneyim, beceri ve Hakkında bölümü ayrıştırılıyor." },
  { id: "scoring", title: "İlanlarla karşılaştırıyoruz", description: "Seçtiğin her ilanın gereksinimleri profilinde aranıyor." },
  { id: "writing", title: "Başlık ve Hakkında önerisi yazıyoruz", description: "Öneri, profilinde yazanlara karşı kontrol ediliyor." },
]

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

const reportKey = (resumeId: string) => ["linkedin-report", resumeId] as const

/**
 * LinkedIn profil raporu (DOG-69). Kullanıcı LinkedIn'de profilini PDF olarak
 * indirip kütüphanesine yüklüyor; profil sayfası sunucudan çekilmiyor. Rapor
 * profile dokunmuyor: kullanıcı önerileri LinkedIn'de kendisi uyguluyor.
 */
export function LinkedInView() {
  const library = useLibrary(true)
  const cards = useApplicationCards()
  const queryClient = useQueryClient()
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const resumes = library.data ?? []
  const chosen = resumeId ?? resumes.find((r) => /linkedin/i.test(`${r.label ?? ""} ${r.fileName ?? ""}`))?.id ?? resumes[0]?.id ?? null
  const report = useQuery({
    queryKey: reportKey(chosen ?? "-"),
    enabled: !!chosen,
    queryFn: async () => (await api.get<{ linkedinReport: LinkedInReportRecord | null }>(`/resumes/${encodeURIComponent(chosen!)}`)).data.linkedinReport,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2500 : false),
  })
  const start = useMutation({
    mutationFn: async () => {
      await api.post(`/resumes/${encodeURIComponent(chosen!)}`, { type: "linkedin-report", analysisIds: picked })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKey(chosen!) }),
  })

  const analyses = (cards.data ?? []).slice(0, 20)
  const record = report.data ?? null
  // Uçla aynı kural: 10 dakikadan eski "running" takılmış sayılıyor.
  const running = record?.status === "running" && Date.now() - Date.parse(record.createdAt) < 10 * 60_000

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_REPORT_POSTINGS ? [...p, id] : p))
  }

  async function create() {
    setError(null)
    try {
      await start.mutateAsync()
    } catch (e) {
      setError(await apiErrorMessage(e, "Raporu başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <div className="space-y-6">
      <ol className="m-0 list-none space-y-4 p-0">
        <Step number={1} title="Profilinin PDF'i" done={!!chosen}>
          <p className="m-0 text-sm text-muted-foreground">
            Profilini PDF olarak{" "}
            <Link href="/cvs" className="font-medium text-primary">
              CV&apos;lerim
            </Link>
            &apos;e yükle; profil sayfanı biz çekmiyoruz.
          </p>
          <details className="group mt-2 text-sm">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-medium text-primary">
              <CircleHelp className="size-4" aria-hidden />
              LinkedIn'den PDF nasıl indirilir?
              <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="mt-2 mb-0 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>LinkedIn'de kendi profil sayfanı aç.</li>
              <li>
                Profil başlığının altındaki <span className="font-medium text-foreground">Daha fazla</span> düğmesine bas.
              </li>
              <li>
                <span className="font-medium text-foreground">PDF olarak kaydet</span>&apos;i seç; dosya bilgisayarına iner.
              </li>
            </ol>
          </details>
          {resumes.length > 0 ? (
            <Select value={chosen ?? ""} onValueChange={setResumeId}>
              <SelectTrigger aria-label="LinkedIn PDF'in" className="mt-3 w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {resumes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <FileText aria-hidden />
                    {r.label || r.fileName || "CV"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            !library.isPending && (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/cvs">
                  <FilePlus2 aria-hidden />
                  CV'lerim'e yükle
                </Link>
              </Button>
            )
          )}
        </Step>

        <Step number={2} title="Hedeflediğin ilanlar" done={picked.length > 0}>
          <p className="m-0 text-sm text-muted-foreground">
            Daha önce analiz ettiğin ilanlardan en fazla {MAX_REPORT_POSTINGS} tanesini seç.{" "}
            <span className="tabular-nums">
              ({picked.length}/{MAX_REPORT_POSTINGS})
            </span>
          </p>
          {analyses.length > 0 ? (
            <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
              {analyses.map((c) => {
                const checked = picked.includes(c.analysisId)
                const disabled = !checked && picked.length >= MAX_REPORT_POSTINGS
                return (
                  <li key={c.analysisId}>
                    <Label
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal transition-colors",
                        checked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
                        disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(c.analysisId)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.position}</span>
                        {c.company && <span className="block truncate text-xs text-muted-foreground">{c.company}</span>}
                      </span>
                    </Label>
                  </li>
                )
              })}
            </ul>
          ) : (
            !cards.isPending && (
              <p className="m-0 mt-3 text-sm text-muted-foreground">
                Henüz analizin yok.{" "}
                <Link href="/analyze" className="font-medium text-primary">
                  Bir ilanı ölç
                </Link>
                , sonra buraya dön.
              </p>
            )
          )}
        </Step>

        <Step number={3} title="Rapor" done={record?.status === "done"} last>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void create()} disabled={!chosen || picked.length === 0 || running || start.isPending}>
              {running || start.isPending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {record?.status === "done" ? "Yeniden oluştur" : "Raporu hazırla"}
            </Button>
            {record?.status === "done" && (
              <span className="text-sm text-muted-foreground">Son rapor {DATE.format(new Date(record.createdAt))}</span>
            )}
          </div>
          {error && (
            <p role="alert" className="m-0 mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </Step>
      </ol>

      {running && record?.status === "running" && (
        <StageTimeline
          heading="Raporun hazırlanıyor"
          subtitle="Genelde bir dakika kadar sürüyor."
          stages={deriveStageStates(REPORT_STAGES, record.stage ?? null)}
        />
      )}
      {record?.status === "failed" && <p className="m-0 text-sm text-destructive">Raporu hazırlayamadık. Tekrar dener misin?</p>}
      {record?.status === "done" && <ReportView report={record.report} />}
    </div>
  )
}

/** Adımlı kartın bir adımı (DOG-151): numara, ray ve içerik. */
function Step({
  number,
  title,
  done,
  last = false,
  children,
}: {
  number: number
  title: string
  done: boolean
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <li className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors",
            done ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground",
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : number}
        </span>
        {!last && <span aria-hidden className={cn("mt-2 w-0.5 flex-1 rounded-full", done ? "bg-primary/40" : "bg-border")} />}
      </div>
      <Card className="mb-0 min-w-0 flex-1 gap-3 py-5 shadow-xs">
        <CardHeader className="px-5">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="px-5">{children}</CardContent>
      </Card>
    </li>
  )
}

export function ReportView({ report }: { report: LinkedInReport }) {
  const warnings = report.checks.filter((c) => c.status !== "ok").length
  const tabs = [
    ...(report.suggestions ? [{ id: "suggestions", label: "Öneriler", count: null }] : []),
    { id: "checks", label: "Profil kontrolleri", count: warnings || null },
    { id: "missing", label: "Eksik kavramlar", count: report.commonMissing.length || null },
  ]
  return (
    <Tabs defaultValue={tabs[0]!.id} className="gap-4">
      <TabsList aria-label="Rapor" className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="px-3">
            {t.label}
            {t.count !== null && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                {t.count}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* İçerikler hep çiziliyor (gizli sekme saklı): sekme değiştirmek kopyalama durumunu silmesin. */}
      {report.suggestions && (
        <TabsContent value="suggestions" forceMount className="data-[state=inactive]:hidden">
          <Card className="gap-4 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Öneriler</CardTitle>
              <CardDescription>
                Yalnızca profilinde yazanlarla; başlığa yalnızca profilinde geçen beceriler giriyor. Kopyalayıp LinkedIn'de
                kendin güncelle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SuggestionBlock
                title="Başlık"
                current={report.headline}
                suggestion={report.suggestions.headline}
                measure={(t) => `${t.length}/${HEADLINE_MAX_CHARS} karakter`}
              />
              <SuggestionBlock
                title="Hakkında"
                current={report.about}
                suggestion={report.suggestions.about}
                measure={(t) => `${t.split(/\s+/).filter(Boolean).length} kelime · önerilen ${ABOUT_TARGET_WORDS.min}–${ABOUT_TARGET_WORDS.max}`}
              />
            </CardContent>
          </Card>
        </TabsContent>
      )}

      <TabsContent value="checks" forceMount className="data-[state=inactive]:hidden">
        <Card className="gap-3 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">Profil kontrolleri</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="m-0 list-none divide-y p-0 text-sm">
              {report.checks.map((c) => (
                <li key={c.id} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
                  {c.status === "ok" ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-green" aria-label="Geçti" />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-label="Uyarı" />
                  )}
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
            {report.headline && (
              <p className="m-0 mt-3 text-sm text-muted-foreground">
                Şu anki başlığın: <span className="text-foreground">{report.headline}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="missing" forceMount className="data-[state=inactive]:hidden">
        <Card className="gap-3 shadow-xs">
          <CardHeader>
            <CardTitle className="text-base">İlanlarda geçen, profilinde görünmeyenler</CardTitle>
            <CardDescription>
              {report.postings.length > 1 ? "Seçtiğin ilanların en az ikisinde isteniyor." : "Seçtiğin ilanda isteniyor."} Deneyiminde
              varsa profiline ekle; yoksa ekleme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.commonMissing.length > 0 ? (
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {report.commonMissing.map((m) => (
                  <li key={m.term}>
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-sm font-normal">
                      {m.term}
                      {m.must && <span className="text-xs font-medium text-brand-amber">zorunlu</span>}
                      {report.postings.length > 1 && <span className="text-xs text-muted-foreground">{m.postings} ilanda</span>}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm">Ortak bir eksik görünmüyor.</p>
            )}
            <p className="m-0 mt-3 text-xs text-muted-foreground">
              Karşılaştırılan ilanlar: {report.postings.map((p) => `${p.position}${p.company ? ` (${p.company})` : ""}`).join(", ")}
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function SuggestionBlock({
  title,
  current,
  suggestion,
  measure,
}: {
  title: string
  current: string | null
  suggestion: LinkedInSuggestion
  measure: (text: string) => string
}) {
  const [copied, setCopied] = useState(false)
  const flagged = suggestion.verification.status === "flagged"
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-sm font-semibold">{title}</h3>
        {flagged && <Badge className="bg-brand-amber/15 text-brand-amber">Kontrol et</Badge>}
      </div>
      {current && <p className="m-0 mt-1 text-xs text-muted-foreground">Şu anki: {current}</p>}
      <p className="m-0 mt-2 rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed whitespace-pre-line">{suggestion.text}</p>
      {flagged && (
        <p className="m-0 mt-2 flex gap-1.5 text-sm text-brand-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Kontrol et: {suggestion.verification.issues.map((i) => i.detail).join(" ")}</span>
        </p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">{measure(suggestion.text)}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto h-7"
          onClick={() => void navigator.clipboard.writeText(suggestion.text).then(() => setCopied(true))}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </Button>
      </div>
    </div>
  )
}
