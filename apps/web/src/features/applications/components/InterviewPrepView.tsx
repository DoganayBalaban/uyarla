"use client"

import Link from "next/link"
import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, LoaderCircle, Sparkles, TriangleAlert, X } from "lucide-react"
import { PageCrumb } from "@/components/layout/app-shell/PageActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { InterviewPrep, InterviewPrepRecord } from "@uyarla/core/interview/prep"
import {
  ANSWER_MAX_LENGTH,
  ANSWER_MAX_WORDS,
  ANSWER_MIN_LENGTH,
  ANSWER_MIN_WORDS,
  MAX_PRACTICE_PER_QUESTION,
  type PracticeEntry,
} from "@uyarla/core/interview/practiceRecord"
import { api, apiErrorMessage, apiStatus } from "@/lib/api"
import { StageTimeline } from "@/features/analysis/components/StageTimeline"
import { deriveStageStates } from "@/features/analysis/stageStates"

/** Paketin gerçek adımları (DOG-136); hangisinde olduğunu worker kayda yazıyor. */
const PREP_STAGES = [
  { id: "reading", title: "Gönderdiğin belgeleri okuyoruz", description: "Başvurduğun CV, ön yazı ve ilanın eksik kalan şartları." },
  { id: "writing", title: "Olası soruları ve cevap iskeletlerini yazıyoruz", description: "Kanıtlar CV'nden birebir alınıyor ve kontrol ediliyor." },
]

interface PrepData {
  position: string
  company: string | null
  stage: string
  interviewAt: string | null
  adaptationId: string | null
  interviewPrep: InterviewPrepRecord | null
  prepAttemptsLeft: number
}

const key = (id: string) => ["interview-prep", id] as const

const KIND_LABEL = { technical: "Teknik", behavioral: "Davranışsal", gap: "Boşluk" } as const
const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" })

/**
 * Mülakat hazırlık paketi (DOG-118). Kaynak başvurunun gönderilen CV'si ve
 * ön yazısı: kanıtlar CV'den birebir, köşeli parantezli yerleri kullanıcı
 * kendi bildiğiyle dolduruyor. "Kağıtta olmayan iddia odada yok."
 */
export function InterviewPrepView({ analysisId }: { analysisId: string }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: key(analysisId),
    queryFn: async () => (await api.get<PrepData>(`/applications/${encodeURIComponent(analysisId)}`)).data,
    refetchInterval: (q) => {
      const r = q.state.data?.interviewPrep
      return r?.status === "running" || r?.practice?.some((p) => p.status === "running") ? 2500 : false
    },
  })
  const start = useMutation({
    mutationFn: async () => {
      await api.post(`/applications/${encodeURIComponent(analysisId)}`, { type: "interview-prep" })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(analysisId) }),
  })

  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Hazırlık yükleniyor" className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-40 rounded-xl" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <p className="text-muted-foreground">
        {apiStatus(query.error) === 404 ? "Bu başvuruyu bulamadık." : "Yükleyemedik. Sayfayı yenileyebilir misin?"}
      </p>
    )
  }
  const data = query.data
  const record = data.interviewPrep
  const prep = record?.prep
  const running = record?.status === "running"

  async function create() {
    setError(null)
    try {
      await start.mutateAsync()
    } catch (e) {
      setError(await apiErrorMessage(e, "Hazırlık paketini başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <div className="space-y-6">
      <PageCrumb label={data.position} />
      <header>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Mülakat hazırlığı</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          {data.position}
          {data.company ? ` · ${data.company}` : ""}
          {data.interviewAt ? ` · ${DATE.format(new Date(`${data.interviewAt}T00:00:00Z`))}` : ""}
        </p>
        <p className="m-0 mt-3 text-sm text-muted-foreground">
          Gönderdiğin CV&apos;den ve ön yazından hazırlandı. Kağıtta olmayan bir iddiayı mülakatta da kurma; köşeli
          parantezli yerleri kendi bildiğinle doldur.
          {data.adaptationId && (
            <>
              {" "}
              <Link href={`/adapt/${data.adaptationId}`} className="font-medium text-primary">
                Gönderdiğin CV
              </Link>
            </>
          )}
        </p>
      </header>

      {running && record?.status === "running" && (
        <StageTimeline
          heading="Hazırlık paketin hazırlanıyor"
          subtitle="Bir dakika kadar sürebilir."
          stages={deriveStageStates(PREP_STAGES, record.stage ?? null)}
        />
      )}
      {record?.status === "failed" && <p className="m-0 text-sm text-destructive">Hazırlık paketini yazamadık. Tekrar dener misin?</p>}

      {!running && data.prepAttemptsLeft > 0 && (
        <Button type="button" variant={prep ? "outline" : "default"} onClick={() => void create()} disabled={start.isPending}>
          {start.isPending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
          {prep ? `Yeniden hazırla (${data.prepAttemptsLeft} hakkın kaldı)` : "Hazırlık paketini oluştur"}
        </Button>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}

      {prep && <PrepSections prep={prep} practice={{ analysisId, entries: record?.practice ?? [] }} />}
    </div>
  )
}

function Flag({ issues }: { issues: Array<{ detail: string }> }) {
  return (
    <p className="m-0 mt-2 flex gap-1.5 text-sm text-brand-amber">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Kontrol et: {issues.map((i) => i.detail.replace("Bu paragrafta", "Burada")).join(" ")} Söyleyebileceğin bir şey
        değilse çıkar.
      </span>
    </p>
  )
}

export function PrepSections({ prep, practice }: { prep: InterviewPrep; practice?: { analysisId: string; entries: PracticeEntry[] } }) {
  const bridges = prep.consistency.length + prep.bridges.length
  const tabs = [
    { id: "questions", label: "Olası sorular", count: prep.questions.length },
    ...(bridges > 0 ? [{ id: "bridges", label: "Köprüler", count: bridges }] : []),
    ...(prep.askThem.length > 0 ? [{ id: "ask", label: "Sorulacaklar", count: prep.askThem.length }] : []),
    ...(practice ? [{ id: "practice", label: "Pratik", count: null }] : []),
  ]
  return (
    <Tabs defaultValue="questions" className="gap-4">
      <TabsList aria-label="Hazırlık" className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit [&::-webkit-scrollbar]:hidden">
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

      {/* İçerikler hep çiziliyor (gizli sekme saklı): yazılan pratik cevabı sekme değişince kaybolmasın. */}
      <TabsContent value="questions" forceMount className="data-[state=inactive]:hidden">
        <ol className="m-0 list-none space-y-4 p-0">
          {prep.questions.map((q, i) => (
            <li key={i}>
              <Card className="gap-3 py-5 shadow-xs">
                <CardHeader className="px-5">
                  <CardTitle className="text-sm leading-snug">
                    <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                    {q.question}{" "}
                    <Badge variant="outline" className="ml-1 align-middle text-xs font-medium text-muted-foreground">
                      {KIND_LABEL[q.kind]}
                    </Badge>
                  </CardTitle>
                  {q.why && <CardDescription>{q.why}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3 px-5 text-sm">
                  {q.evidence.length > 0 && (
                    <p className="m-0">
                      <span className="font-medium">CV&apos;ndeki dayanağın:</span> {q.evidence.join(" · ")}
                    </p>
                  )}
                  <dl className="m-0 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 p-3">
                    {(Object.keys(STAR_LABEL) as Array<keyof typeof STAR_LABEL>).map((k) => (
                      <Fragment key={k}>
                        <dt className="text-muted-foreground">{STAR_LABEL[k]}</dt>
                        <dd className="m-0">{q.star[k]}</dd>
                      </Fragment>
                    ))}
                  </dl>
                  {q.verification.status === "flagged" && <Flag issues={q.verification.issues} />}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </TabsContent>

      {bridges > 0 && (
        <TabsContent value="bridges" forceMount className="space-y-4 data-[state=inactive]:hidden">
          {prep.consistency.length > 0 && (
            <Card className="gap-3 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Savunmaya hazır ol</CardTitle>
                <CardDescription>Görüşmeci CV&apos;ndeki bu iddiaların üstüne gidebilir.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="m-0 list-none divide-y p-0 text-sm">
                  {prep.consistency.map((c, i) => (
                    <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                      <span className="font-medium">{c.claim}</span>
                      <span className="block text-muted-foreground">
                        {c.reason === "quantity"
                          ? "Bu sayıyı neye göre ölçtüğünü, başlangıç noktasını ve senin payını anlatabilmelisin."
                          : "Bu maddeyi ilanın diliyle yeniden yazdık; kendi kelimelerinle ve bir örnekle anlatabilmelisin."}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {prep.bridges.length > 0 && (
            <Card className="gap-3 shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Eksik kalan gereksinimler</CardTitle>
                <CardDescription>Soru gelirse sahiplenme; dürüst bir köprü kur.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="m-0 list-none divide-y p-0 text-sm">
                  {prep.bridges.map((b, i) => (
                    <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                      <span className="font-medium">{b.requirement}</span>
                      <span className="block">{b.answer}</span>
                      {b.verification.status === "flagged" && <Flag issues={b.verification.issues} />}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      )}

      {prep.askThem.length > 0 && (
        <TabsContent value="ask" forceMount className="data-[state=inactive]:hidden">
          <Card className="gap-3 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Senin soracakların</CardTitle>
              <CardDescription>Görüşmenin sonunda sorulacak sorular; şirketi ve rolü anlamana yarar.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm">
                {prep.askThem.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {practice && (
        <TabsContent value="practice" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <p className="m-0 text-sm text-muted-foreground">
            Bir soruyu seç, mülakatta söyleyeceğin gibi yaz. Geri bildirim STAR yapısına, uzunluğa ve CV&apos;nde olmayan
            iddialara bakar.
          </p>
          {prep.questions.map((q, i) => (
            <Card key={i} className="gap-2 py-4 shadow-xs">
              <CardHeader className="px-5">
                <CardTitle className="text-sm leading-snug">
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {q.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 text-sm">
                <PracticeBox analysisId={practice.analysisId} questionIndex={i} entries={practice.entries.filter((p) => p.questionIndex === i)} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      )}
    </Tabs>
  )
}

const STAR_LABEL = { situation: "Durum", task: "Görev", action: "Eylem", result: "Sonuç" } as const

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * Yazılı pratik (DOG-97): kullanıcı cevabını yazıyor, geri bildirim STAR
 * yapısı, güçlü ve geliştirilecek yanlar, uzunluk ve "kağıtta yok". Kağıtta
 * yok kodla bulunuyor: cevaptaki sayı ya da ilan terimi CV'de yoksa.
 */
function PracticeBox({ analysisId, questionIndex, entries }: { analysisId: string; questionIndex: number; entries: PracticeEntry[] }) {
  const queryClient = useQueryClient()
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const send = useMutation({
    mutationFn: async () => {
      await api.post(`/applications/${encodeURIComponent(analysisId)}`, { type: "practice", questionIndex, answer })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(analysisId) }),
  })
  const latest = entries.at(-1)
  const running = latest?.status === "running"
  const used = entries.filter((e) => e.status !== "failed").length
  const left = MAX_PRACTICE_PER_QUESTION - used
  const words = countWords(answer)

  async function submit() {
    setError(null)
    try {
      await send.mutateAsync()
    } catch (e) {
      setError(await apiErrorMessage(e, "Cevabını gönderemedik. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <details className="group" open={entries.length > 0}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-medium text-primary">
        Cevabını yaz, geri bildirim al
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      {latest?.status === "done" && latest.feedback && <PracticeResult answer={latest.answer} feedback={latest.feedback} />}
      {latest?.status === "failed" && <p className="m-0 mt-2 text-destructive">Cevabını değerlendiremedik. Tekrar dener misin?</p>}
      {running ? (
        <p className="m-0 mt-2 flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="size-4 text-primary motion-safe:animate-spin" aria-hidden />
          Cevabını okuyoruz…
        </p>
      ) : left > 0 ? (
        <div className="mt-3 space-y-2">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={ANSWER_MAX_LENGTH}
            rows={6}
            aria-label="Cevabın"
            placeholder="Mülakatta söyleyeceğin gibi yaz: durum, görev, ne yaptın, sonuç."
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" onClick={() => void submit()} disabled={send.isPending || answer.trim().length < ANSWER_MIN_LENGTH}>
              Geri bildirim al
            </Button>
            <span className="text-xs text-muted-foreground">
              {words} kelime · önerilen {ANSWER_MIN_WORDS}–{ANSWER_MAX_WORDS} · {left} hakkın kaldı
            </span>
          </div>
        </div>
      ) : (
        <p className="m-0 mt-2 text-muted-foreground">Bu soru için geri bildirim hakkın doldu.</p>
      )}
      {error && (
        <p role="alert" className="m-0 mt-2 text-destructive">
          {error}
        </p>
      )}
    </details>
  )
}

function PracticeResult({ answer, feedback }: { answer: string; feedback: NonNullable<PracticeEntry["feedback"]> }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="m-0 rounded-lg border bg-muted/30 p-3 whitespace-pre-line text-muted-foreground">{answer}</p>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {(Object.keys(STAR_LABEL) as Array<keyof typeof STAR_LABEL>).map((k) => (
          <li key={k} className={`flex items-center gap-1 ${feedback.star[k] ? "text-brand-green" : "text-muted-foreground"}`}>
            {feedback.star[k] ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
            {STAR_LABEL[k]}
            <span className="sr-only">{feedback.star[k] ? " var" : " eksik"}</span>
          </li>
        ))}
      </ul>
      {feedback.length !== "ok" && (
        <p className="m-0 text-muted-foreground">
          {feedback.words} kelime;{" "}
          {feedback.length === "short" ? "biraz kısa, bir örnek ya da sonuç ekleyebilirsin." : "uzun, mülakatta iki dakikayı geçer; kısalt."}
        </p>
      )}
      {feedback.strengths.length > 0 && (
        <div>
          <span className="font-medium">İyi olan</span>
          <ul className="m-0 mt-1 pl-5">
            {feedback.strengths.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.improvements.length > 0 && (
        <div>
          <span className="font-medium">Geliştir</span>
          <ul className="m-0 mt-1 pl-5">
            {feedback.improvements.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.offPaper.map((t, i) => (
        <p key={i} className="m-0 flex gap-1.5 text-brand-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t}</span>
        </p>
      ))}
    </div>
  )
}
