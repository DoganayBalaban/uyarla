"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, LoaderCircle, MessagesSquare, RotateCcw, SendHorizontal, TriangleAlert, X } from "lucide-react"
import { PageCrumb } from "@/components/layout/app-shell/PageActions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  INTERVIEWER_NAME,
  SIMULATION_MAIN_QUESTIONS,
  SIMULATION_MESSAGE_MAX_LENGTH,
  simulationProgress,
  type SimulationMessage,
  type SimulationRecord,
  type SimulationReport,
} from "@uyarla/core/interview/simulationRecord"
import { apiErrorMessage, apiStatus } from "@/lib/api"
import { cn } from "@/lib/cn"
import { billingStatusKey, useBillingStatus } from "@/features/billing/api"
import { LockedFeature, isLocked } from "@/features/billing/components/LockedFeature"
import type { SimulationRequest } from "@/features/applications/schema"
import { useSimulationAction, useSimulations, type SimulationData } from "@/features/applications/simulationApi"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

/**
 * Mülakat simülasyonu (DOG-172): Deniz ilanı ve gönderilen CV'yi bilerek
 * görüşme yapıyor; sonunda her cevap için geri bildirim. Ekrandaki her durum
 * gerçek: "yazıyor" iş kuyruktayken, "Soru 2 / 5" sorulan ana soru sayısı.
 */
export function InterviewSimulation({ analysisId }: { analysisId: string }) {
  const queryClient = useQueryClient()
  const query = useSimulations(analysisId)
  const action = useSimulationAction(analysisId)
  const billing = useBillingStatus()
  const locked = isLocked(billing.data)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prepPath = `/applications/${encodeURIComponent(analysisId)}/interview`

  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Görüşme yükleniyor" className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-72 rounded-xl" />
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
  const simulations = data.simulations
  const current = simulations.find((s) => s.id === selected) ?? simulations.at(-1) ?? null
  const active = simulations.find((s) => s.phase !== "done") ?? null

  async function run(body: SimulationRequest, fallback: string): Promise<boolean> {
    setError(null)
    try {
      const simulation = await action.mutateAsync(body)
      if (body.type === "start") setSelected(simulation.id)
      return true
    } catch (e) {
      // Abonelik bitmiş olabilir: durum yenilenince kilit kartı görünüyor.
      if (apiStatus(e) === 402) void queryClient.invalidateQueries({ queryKey: billingStatusKey })
      setError(await apiErrorMessage(e, fallback))
      return false
    }
  }
  const start = () => run({ type: "start" }, "Görüşmeyi başlatamadık. Birazdan tekrar dener misin?")

  return (
    <div className="space-y-6">
      <PageCrumb label={data.position} />
      <header>
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Mülakat simülasyonu</h1>
        <p className="m-0 mt-1 text-sm text-muted-foreground">
          {data.position}
          {data.company ? ` · ${data.company}` : ""} ·{" "}
          <Link href={prepPath} className="font-medium text-primary">
            Hazırlık paketi
          </Link>
        </p>
      </header>

      {simulations.length > 1 && (
        <nav aria-label="Görüşmeler" className="flex flex-wrap gap-2">
          {simulations.map((s, i) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={s.id === current?.id ? "secondary" : "ghost"}
              aria-current={s.id === current?.id ? "true" : undefined}
              onClick={() => setSelected(s.id)}
            >
              {i + 1}. görüşme
              <span className="text-xs font-normal text-muted-foreground">{s.phase === "done" ? DATE.format(new Date(s.createdAt)) : "sürüyor"}</span>
            </Button>
          ))}
        </nav>
      )}

      {!data.ready ? (
        <p className="m-0 text-muted-foreground">Analiz bitince görüşmeyi başlatabilirsin.</p>
      ) : current ? (
        <Conversation
          key={current.id}
          simulation={current}
          data={data}
          busy={action.isPending}
          onAction={run}
        />
      ) : locked ? (
        <LockedFeature
          title="Mülakat simülasyonu"
          description={`${INTERVIEWER_NAME} ilanı ve CV'ni bilerek görüşmeni yapar; sonunda her cevabına geri bildirim verir.`}
          returnTo={`${prepPath}/simulation`}
        />
      ) : (
        <Intro data={data} busy={action.isPending} onStart={() => void start()} />
      )}

      {data.ready && current?.phase === "done" && !active && !locked && data.simulationsLeft > 0 && (
        <Button type="button" variant="outline" onClick={() => void start()} disabled={action.isPending}>
          {action.isPending ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Yeni görüşme ({data.simulationsLeft} hakkın kaldı)
        </Button>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function InterviewerAvatar({ size = "default" }: { size?: "default" | "sm" | "lg" }) {
  return (
    <Avatar size={size} aria-hidden>
      <AvatarFallback className="bg-primary/10 font-semibold text-primary">{INTERVIEWER_NAME[0]}</AvatarFallback>
    </Avatar>
  )
}

function Intro({ data, busy, onStart }: { data: SimulationData; busy: boolean; onStart: () => void }) {
  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-row items-center gap-3">
        <InterviewerAvatar size="lg" />
        <div>
          <CardTitle className="text-base">{INTERVIEWER_NAME} ile görüşme provası</CardTitle>
          <CardDescription>
            {INTERVIEWER_NAME}, {data.company ? `${data.company} için ` : ""}
            {data.position} görüşmeni yapacak.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="m-0 list-disc space-y-1.5 pl-5">
          <li>İlanın gereksinimlerini ve gönderdiğin CV&apos;yi biliyor; ilanda yazmayan şirket bilgisini bilmiyor, uydurmuyor.</li>
          <li>{SIMULATION_MAIN_QUESTIONS} ana soru soruyor; cevabın belirsizse ya da CV&apos;nde olmayan bir şey söylersen üstüne gidiyor.</li>
          <li>Cevaplarını mülakatta söyleyeceğin gibi yaz. Sonunda her cevabın için geri bildirim alırsın.</li>
          {data.language === "en" && <li>İlan İngilizce; görüşme de İngilizce.</li>}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onStart} disabled={busy || data.simulationsLeft === 0}>
            {busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <MessagesSquare aria-hidden />}
            Görüşmeyi başlat
          </Button>
          <span className="text-xs text-muted-foreground">
            {data.simulationsLeft > 0 ? `Bu başvuru için ${data.simulationsLeft} hakkın var` : "Bu başvuru için görüşme hakkın doldu"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function Conversation({
  simulation,
  data,
  busy,
  onAction,
}: {
  simulation: SimulationRecord
  data: SimulationData
  busy: boolean
  onAction: (body: SimulationRequest, fallback: string) => Promise<boolean>
}) {
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const seen = useRef(simulation.messages.length)
  const { asked, total } = simulationProgress(simulation.messages)
  const typing = simulation.phase === "interviewer" && !simulation.failed
  const yourTurn = simulation.phase === "candidate"
  const live = simulation.phase !== "done"

  // Yeni mesaj gelince sona kaydır; sayfa ilk açıldığında kaydırma yok.
  useEffect(() => {
    if (simulation.messages.length === seen.current && !typing) return
    seen.current = simulation.messages.length
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    endRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
  }, [simulation.messages.length, typing])

  async function send() {
    const answer = text.trim()
    if (!answer) return
    const ok = await onAction({ type: "answer", simulationId: simulation.id, text: answer }, "Cevabını gönderemedik. Birazdan tekrar dener misin?")
    if (ok) setText("")
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0 shadow-xs">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <InterviewerAvatar />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-medium">{INTERVIEWER_NAME}</p>
            <p className="m-0 truncate text-xs text-muted-foreground">
              Görüşmeci · {data.position}
              {data.company ? ` · ${data.company}` : ""}
            </p>
          </div>
          {asked > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              Soru {asked} / {total}
            </Badge>
          )}
          {live && simulation.phase !== "report" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onAction({ type: "end", simulationId: simulation.id }, "Görüşmeyi bitiremedik. Birazdan tekrar dener misin?")}
            >
              Görüşmeyi bitir
            </Button>
          )}
        </div>

        <div role="log" aria-live="polite" aria-label="Görüşme" className="space-y-3 px-4 py-4">
          {simulation.messages.map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
          {typing && (
            <div className="flex items-end gap-2" role="status">
              <InterviewerAvatar size="sm" />
              <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
                    style={{ animationDelay: `${d * 150}ms` }}
                  />
                ))}
              </span>
              <span className="sr-only">{INTERVIEWER_NAME} yazıyor</span>
            </div>
          )}
          {simulation.failed && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-destructive" role="alert">
              <span>{simulation.phase === "report" ? "Geri bildirimi yazamadık." : `${INTERVIEWER_NAME}'in mesajı gelmedi.`}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void onAction({ type: "retry", simulationId: simulation.id }, "Yeniden deneyemedik. Birazdan tekrar dener misin?")}
              >
                <RotateCcw aria-hidden />
                Tekrar dene
              </Button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {yourTurn && (
          <form
            className="space-y-2 border-t px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter gönderir, Shift+Enter yeni satır; Türkçe klavyede birleştirme sürerken göndermiyor.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send()
                }
              }}
              maxLength={SIMULATION_MESSAGE_MAX_LENGTH}
              rows={3}
              autoFocus
              aria-label="Cevabın"
              placeholder="Mülakatta söyleyeceğin gibi yaz…"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Enter ile gönder, Shift+Enter ile yeni satır</span>
              <Button type="submit" size="sm" disabled={busy || !text.trim()}>
                {busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <SendHorizontal aria-hidden />}
                Gönder
              </Button>
            </div>
          </form>
        )}
      </Card>

      {simulation.phase === "report" && !simulation.failed && (
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 text-primary motion-safe:animate-spin" aria-hidden />
          Cevaplarını okuyoruz; geri bildirimin hazırlanıyor…
        </p>
      )}
      {simulation.phase === "done" && simulation.report && <Report report={simulation.report} />}
    </div>
  )
}

function Bubble({ message }: { message: SimulationMessage }) {
  if (message.role === "interviewer") {
    return (
      <div className="flex items-end gap-2">
        <InterviewerAvatar size="sm" />
        <p className="m-0 max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm whitespace-pre-line">
          <span className="sr-only">{INTERVIEWER_NAME}: </span>
          {message.text}
        </p>
      </div>
    )
  }
  return (
    <div className="flex justify-end">
      <p className="m-0 max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm whitespace-pre-line text-primary-foreground">
        <span className="sr-only">Sen: </span>
        {message.text}
      </p>
    </div>
  )
}

const STAR_LABEL = { situation: "Durum", task: "Görev", action: "Eylem", result: "Sonuç" } as const

export function Report({ report }: { report: SimulationReport }) {
  if (report.answers.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">Hiç cevap vermeden bitirdin; geri bildirim için en az bir soruyu cevapla.</p>
  }
  return (
    <section aria-labelledby="simulation-report" className="space-y-4">
      <h2 id="simulation-report" className="m-0 text-lg font-semibold tracking-tight">
        Geri bildirim
      </h2>
      {(report.strengths.length > 0 || report.improvements.length > 0) && (
        <Card className="gap-3 shadow-xs">
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            {report.strengths.length > 0 && (
              <div>
                <p className="m-0 font-medium">İyi olan</p>
                <ul className="m-0 mt-1 list-disc space-y-1 pl-5">
                  {report.strengths.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.improvements.length > 0 && (
              <div>
                <p className="m-0 font-medium">Geliştir</p>
                <ul className="m-0 mt-1 list-disc space-y-1 pl-5">
                  {report.improvements.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <ol className="m-0 list-none space-y-3 p-0">
        {report.answers.map((a, i) => (
          <li key={i}>
            <Card className="gap-2 py-4 shadow-xs">
              <CardHeader className="px-5">
                <CardTitle className="text-sm leading-snug">
                  <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {a.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-5 text-sm">
                {/* İlk soru tanışma; STAR beklenmiyor. */}
                {i > 0 && (
                  <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
                    {(Object.keys(STAR_LABEL) as Array<keyof typeof STAR_LABEL>).map((k) => (
                      <li key={k} className={cn("flex items-center gap-1", a.star[k] ? "text-brand-green" : "text-muted-foreground")}>
                        {a.star[k] ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                        {STAR_LABEL[k]}
                        <span className="sr-only">{a.star[k] ? " var" : " eksik"}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {a.strength && (
                  <p className="m-0">
                    <span className="font-medium">İyi olan: </span>
                    {a.strength}
                  </p>
                )}
                {a.improvement && (
                  <p className="m-0">
                    <span className="font-medium">Geliştir: </span>
                    {a.improvement}
                  </p>
                )}
                {a.offPaper.map((t, j) => (
                  <p key={j} className="m-0 flex gap-1.5 text-brand-amber">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{t}</span>
                  </p>
                ))}
                <p className="m-0 text-xs text-muted-foreground tabular-nums">{a.words} kelime</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}
