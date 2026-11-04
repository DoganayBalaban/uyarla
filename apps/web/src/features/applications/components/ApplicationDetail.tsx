"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, CircleAlert, FileText, Gauge, LoaderCircle, MessagesSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/cn"
import { apiErrorBody, apiStatus } from "@/lib/api"
import { loginPath } from "@/lib/returnPath"
import { resultPath } from "@/features/analysis/paths"
import { startAdaptation } from "@/features/adaptation/api"
import { plansPath } from "@/features/billing/paywall"
import { useApplicationCards, useUpdateCard, type CardChange } from "@/features/applications/api"
import {
  NOTE_MAX_LENGTH,
  STAGE_COLOR,
  STAGE_LABEL,
  deadlineBadge,
  scoreBadge,
  shouldAskBeforeApplying,
  type BoardCard,
  type Stage,
} from "@/features/applications/board"
import { noteFormSchema, type NoteFormValues } from "@/features/applications/schema"
import { FollowUpPanel, OutreachPanel, followUpKindFor } from "@/features/applications/components/FollowUpPanel"
import { ApplyCheck } from "@/features/applications/components/ApplyCheck"
import { StageSelect } from "@/features/applications/components/StageSelect"
import { DeleteApplication } from "@/features/applications/components/DeleteApplication"
import { PageCrumb } from "@/components/layout/app-shell/PageActions"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" })
const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" })

/** Şeritteki ilerleme yolu; "Olmadı" yolun dışında, ayrı gösteriliyor. */
const PATH: Stage[] = ["saved", "applied", "interview", "offer"]

/**
 * Başvuru detayı (DOG-138, DOG-176): bir başvuruya ait her şey tek ekranda.
 * Sekmeler kalktı; solda iş (CV ve skor, mesajlar, mülakat), sağda bilgi
 * (tarihler, not). Veri panonun sorgusundan: burada yapılan değişiklik
 * panoda da aynı önbellekten görünüyor.
 */
export function ApplicationDetail({ analysisId }: { analysisId: string }) {
  const cardsQuery = useApplicationCards()
  const updateCard = useUpdateCard()
  const [askApply, setAskApply] = useState(false)
  const router = useRouter()

  if (cardsQuery.isPending) {
    return (
      <div aria-busy="true" aria-label="Başvuru yükleniyor" className="space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-20 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }
  if (cardsQuery.isError) {
    return apiStatus(cardsQuery.error) === 401 ? (
      <p className="text-muted-foreground">
        Başvurunu görmek için <Link href={loginPath(`/applications/${analysisId}`)}>giriş yap</Link>.
      </p>
    ) : (
      <p role="alert" className="flex items-center gap-2 text-destructive">
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        Yükleyemedik. Sayfayı yenileyebilir misin?
      </p>
    )
  }
  const card = cardsQuery.data.find((c) => c.analysisId === analysisId)
  if (!card) return <p className="text-muted-foreground">Bu başvuruyu panonda bulamadık.</p>

  function update(change: CardChange) {
    if (change.stage && shouldAskBeforeApplying(card!, change.stage)) {
      setAskApply(true)
      return
    }
    updateCard.mutate({ analysisId, change })
  }

  return (
    <>
      <ApplicationView card={card} onUpdate={update} onDeleted={() => router.push("/applications")} />
      {askApply && (
        <ApplyCheck
          card={card}
          onApply={() => {
            updateCard.mutate({ analysisId, change: { stage: "applied" } })
            setAskApply(false)
          }}
          onClose={() => setAskApply(false)}
        />
      )}
    </>
  )
}

/** Yüklenmiş başvurunun ekranı; veri ve değişiklik dışarıdan. */
export function ApplicationView({
  card,
  onUpdate,
  onDeleted,
}: {
  card: BoardCard
  onUpdate: (change: CardChange) => void
  onDeleted: () => void
}) {
  return (
    <div>
      <PageCrumb label={card.position} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{card.position}</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {[card.company, `analiz ${DATE.format(new Date(card.createdAt))}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageSelect value={card.stage} onChange={(stage) => onUpdate({ stage })} size="default" />
          <DeleteApplication analysisId={card.analysisId} position={card.position} onDeleted={onDeleted} className="size-9" />
        </div>
      </header>

      <StageTrack card={card} />

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4">
          <ScoreSection card={card} />
          <MessagesSection card={card} />
          <InterviewSection card={card} onUpdate={onUpdate} />
        </div>
        <aside className="grid gap-4 lg:sticky lg:top-20">
          <DatesSection card={card} />
          <Section title="Not" description="Yalnızca sen görürsün.">
            <NoteForm card={card} onUpdate={onUpdate} />
          </Section>
        </aside>
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-4 py-5 shadow-xs">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-5 text-sm">{children}</CardContent>
    </Card>
  )
}

/**
 * Aşama şeridi: kaydedildiden teklife yol ve başvurunun bunun neresinde
 * olduğu. "Olmadı" yolun bir adımı değil; o durumda şerit yerine tek satır.
 */
function StageTrack({ card }: { card: BoardCard }) {
  const since = card.stageChangedAt ? DATE.format(new Date(card.stageChangedAt)) : null
  if (card.stage === "rejected") {
    return (
      <p className="m-0 mt-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm text-muted-foreground">
        <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR.rejected)} />
        <span>
          <span className="font-medium text-foreground">{STAGE_LABEL.rejected}</span>
          {since && ` · ${since}`}
        </span>
      </p>
    )
  }
  const current = PATH.indexOf(card.stage)
  return (
    <ol aria-label="Başvuru aşaması" className="m-0 mt-6 grid list-none grid-cols-4 rounded-xl border p-0">
      {PATH.map((stage, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={stage}
            aria-current={active ? "step" : undefined}
            className={cn("relative px-1 py-3 sm:px-4", i > 0 && "border-l")}
          >
            {/* Telefonda simge adın üstünde; yan yana sığmıyor. */}
            <span className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px]",
                  done && "border-foreground bg-foreground text-background",
                  active && "border-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : active ? <span className={cn("size-2 rounded-full", STAGE_COLOR[stage])} /> : null}
              </span>
              <span className={cn("text-xs sm:text-sm", active ? "font-semibold" : "text-muted-foreground")}>
                {STAGE_LABEL[stage]}
              </span>
            </span>
            {/* Ek ayın adına göre değiştiği için ("Kasım'dan") tarih eksiz. */}
            {active && since && <span className="mt-1 hidden pl-7 text-xs text-muted-foreground sm:block">{since}</span>}
          </li>
        )
      })}
    </ol>
  )
}

function ScoreSection({ card }: { card: BoardCard }) {
  const [adapting, setAdapting] = useState(false)
  const [adaptError, setAdaptError] = useState<string | null>(null)
  const router = useRouter()
  const badge = card.score === null ? null : scoreBadge(card.score, card.scoringRevision)
  const gaps = card.readiness
    ? [
        card.readiness.missingMust > 0 ? `${card.readiness.missingMust} zorunlu gereksinim CV'nde görünmüyor` : null,
        card.readiness.titleMissing ? "ilandaki unvan CV'nde geçmiyor" : null,
      ].filter(Boolean)
    : []

  async function adapt() {
    setAdapting(true)
    setAdaptError(null)
    try {
      const { adaptationId } = await startAdaptation(card.analysisId)
      router.push(`/adapt/${adaptationId}`)
    } catch (error) {
      const body = await apiErrorBody(error)
      // Bu ayki ücretsiz uyarlama bitti (DOG-158): paket ekranına, dönüşte uyarlama başlıyor.
      if (body.code === "adaptation_quota") {
        router.push(plansPath(`/analyze?uyarla=${encodeURIComponent(card.analysisId)}`))
        return
      }
      setAdaptError(
        body.code === "daily_cap" && body.error ? body.error : "Uyarlamayı başlatamadık. Birazdan tekrar dener misin?",
      )
      setAdapting(false)
    }
  }

  return (
    <Section title="CV ve skor">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {badge && card.score !== null && (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{card.score}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", badge.cls)}>{badge.text}</span>
          </div>
        )}
        <div className="min-w-0 flex-1 text-muted-foreground">
          <p className="m-0">
            {card.scoreBefore != null
              ? `Uyarlanmış CV'nin ATS uyum skoru; uyarlamadan önce ${card.scoreBefore}.`
              : "ATS uyum skoru."}
          </p>
          {card.readiness && (
            <p className="m-0 mt-0.5">
              {card.readiness.ready ? "Zorunlu gereksinimlerin tamamı CV'nde karşılanıyor." : `${gaps.join("; ")}.`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link
          href={resultPath(card.analysisId)}
          className="group flex items-start gap-3 rounded-lg border p-4 no-underline transition-colors hover:bg-accent/60"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
            <Gauge className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">Analiz sonucu</span>
            <span className="block text-muted-foreground">Gereksinimler, eksik kavramlar, ilan metni</span>
          </span>
          <ArrowRight className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
        {card.adaptation ? (
          <Link
            href={`/adapt/${card.adaptation.id}`}
            className="group flex items-start gap-3 rounded-lg border p-4 no-underline transition-colors hover:bg-accent/60"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
              <FileText className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">Uyarlanmış CV</span>
              <span className="block text-muted-foreground">CV, ön yazı ve form yanıtları</span>
            </span>
            <ArrowRight className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
            <span className="text-muted-foreground">Bu ilana özel CV henüz yok.</span>
            <Button type="button" size="sm" onClick={() => void adapt()} disabled={adapting}>
              {adapting ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {adapting ? "Hazırlanıyor…" : "CV'ni bu ilana uyarla"}
            </Button>
          </div>
        )}
      </div>
      {adaptError && (
        <p role="alert" className="m-0 mt-3 text-destructive">
          {adaptError}
        </p>
      )}
    </Section>
  )
}

function MessagesSection({ card }: { card: BoardCard }) {
  // Takip/teşekkür başvurulduysa ve mülakattaysa, ağ kurma başvurmadan önce ve sonra.
  const any = followUpKindFor(card) !== null || card.stage === "saved" || card.stage === "applied"
  return (
    <Section
      title="Mesajlar"
      description="Taslaklar gönderdiğin CV'den ve ön yazından; biz göndermiyoruz, kopyalayıp kendin gönderirsin."
    >
      {any ? (
        <div className="flex flex-wrap items-start gap-x-2 [&>*]:mt-0 [&>div]:basis-full">
          <FollowUpPanel card={card} />
          <OutreachPanel card={card} />
        </div>
      ) : (
        <p className="m-0 text-muted-foreground">Bu aşamada önerilen bir mesaj yok.</p>
      )}
    </Section>
  )
}

function InterviewSection({ card, onUpdate }: { card: BoardCard; onUpdate: (change: CardChange) => void }) {
  return (
    <Section title="Mülakat">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor={`mulakat-${card.analysisId}`} className="font-normal text-muted-foreground">
            Mülakat günü
          </Label>
          <Input
            id={`mulakat-${card.analysisId}`}
            type="date"
            value={card.interviewAt ?? ""}
            onChange={(e) => onUpdate({ interviewAt: e.target.value || null })}
            className="w-auto"
          />
        </div>
        {card.stage === "interview" ? (
          <Button asChild variant="outline">
            <Link href={`/applications/${card.analysisId}/interview`}>
              <MessagesSquare aria-hidden />
              Mülakat hazırlığı
            </Link>
          </Button>
        ) : (
          <p className="m-0 text-muted-foreground">Aşamayı &quot;Mülakat&quot; yapınca hazırlık paketi açılır.</p>
        )}
      </div>
      {card.stage === "interview" && (
        <p className="m-0 mt-3 text-muted-foreground">Olası sorular, cevap iskeletleri ve Deniz ile görüşme provası.</p>
      )}
    </Section>
  )
}

function DatesSection({ card }: { card: BoardCard }) {
  const deadline = card.deadline ? deadlineBadge(card) : null
  const rows: Array<[string, string]> = [
    ["Analiz", DATE.format(new Date(card.createdAt))],
    [
      "Aşama",
      card.stageChangedAt
        ? `${STAGE_LABEL[card.stage]} · ${DATE.format(new Date(card.stageChangedAt))}`
        : STAGE_LABEL[card.stage],
    ],
    [
      "Son başvuru",
      deadline?.text ?? (card.deadline ? DAY.format(new Date(`${card.deadline}T00:00:00Z`)) : "İlanda yazmıyor"),
    ],
  ]
  if (card.interviewAt) rows.push(["Mülakat", DAY.format(new Date(`${card.interviewAt}T00:00:00Z`))])
  return (
    <Section title="Tarihler">
      <dl className="m-0 grid gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={cn("m-0 text-right", label === "Son başvuru" && deadline?.tone === "soon" && "font-medium text-brand-amber")}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

function NoteForm({ card, onUpdate }: { card: BoardCard; onUpdate: (change: CardChange) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    values: { note: card.noteText ?? "" },
  })
  const save = handleSubmit(({ note }) => {
    if (note !== (card.noteText ?? "")) onUpdate({ note })
  })
  return (
    <form onSubmit={save} className="text-sm">
      <Textarea
        maxLength={NOTE_MAX_LENGTH}
        {...register("note", { onBlur: () => void save() })}
        rows={5}
        placeholder="Görüştüğün kişi, şirketin ürünleri, soracağın sorular…"
        aria-label="Not"
        aria-invalid={errors.note ? true : undefined}
      />
      {errors.note && (
        <p role="alert" className="mt-1 text-xs text-brand-amber">
          {errors.note.message}
        </p>
      )}
      {isDirty && <p className="m-0 mt-1 text-xs text-muted-foreground">Kutudan çıkınca kaydedilir.</p>}
    </form>
  )
}
