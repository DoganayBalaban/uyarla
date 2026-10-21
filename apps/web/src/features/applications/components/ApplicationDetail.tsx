"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { CircleAlert, FileText, Gauge, LoaderCircle, MessagesSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  deadlineBadge,
  scoreBadge,
  shouldAskBeforeApplying,
  type BoardCard,
} from "@/features/applications/board"
import { noteFormSchema, type NoteFormValues } from "@/features/applications/schema"
import { FollowUpPanel, OutreachPanel } from "@/features/applications/components/FollowUpPanel"
import { ApplyCheck } from "@/features/applications/components/ApplyCheck"
import { StageSelect } from "@/features/applications/components/StageSelect"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" })

type Tab = "summary" | "messages" | "interview" | "note"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "summary", label: "Özet" },
  { id: "messages", label: "Mesajlar" },
  { id: "interview", label: "Mülakat" },
  { id: "note", label: "Not" },
]

/**
 * Başvuru detayı (DOG-138): bir başvuruya ait her şey tek sayfada, sekmelerle.
 * Kart sadeleşti; not, mesajlar ve mülakat buraya taşındı. Veri panonun
 * sorgusundan: burada yapılan değişiklik panoda da aynı önbellekten görünüyor.
 */
export function ApplicationDetail({ analysisId }: { analysisId: string }) {
  const cardsQuery = useApplicationCards()
  const updateCard = useUpdateCard()
  const [askApply, setAskApply] = useState(false)

  if (cardsQuery.isPending) {
    return (
      <div aria-busy="true" aria-label="Başvuru yükleniyor" className="space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-6 h-48 rounded-xl" />
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

  const badge = card.score === null ? null : scoreBadge(card.score)
  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{card.position}</h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {[card.company, `analiz ${DATE.format(new Date(card.createdAt))}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge && card.score !== null && (
            <span className={cn("rounded-full px-2.5 py-1 text-sm font-semibold", badge.cls)} title="ATS uyum skoru">
              {card.score} · {badge.text}
            </span>
          )}
          <StageSelect value={card.stage} onChange={(stage) => update({ stage })} size="default" />
        </div>
      </header>

      <Tabs defaultValue="summary" className="mt-6 gap-4">
        <TabsList aria-label="Başvuru">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="px-3.5">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Card className="py-0 shadow-xs">
          <CardContent className="p-5 sm:p-6">
            <TabsContent value="summary">
              <SummaryTab card={card} />
            </TabsContent>
            <TabsContent value="messages">
              <MessagesTab card={card} />
            </TabsContent>
            <TabsContent value="interview">
              <InterviewTab card={card} onUpdate={update} />
            </TabsContent>
            <TabsContent value="note">
              <NoteTab card={card} onUpdate={update} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

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
    </div>
  )
}

function SummaryTab({ card }: { card: BoardCard }) {
  const [adapting, setAdapting] = useState(false)
  const [adaptError, setAdaptError] = useState<string | null>(null)
  const router = useRouter()
  const deadline = deadlineBadge(card)

  async function adapt() {
    setAdapting(true)
    setAdaptError(null)
    try {
      const { adaptationId } = await startAdaptation(card.analysisId)
      router.push(`/adapt/${adaptationId}`)
    } catch (error) {
      const body = await apiErrorBody(error)
      // Ücretsiz hak bitti (DOG-34): paket ekranına, dönüşte uyarlama başlıyor.
      if (body.code === "payment_required") {
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
    <div className="space-y-4 text-sm">
      {deadline && <p className="m-0 text-muted-foreground">{deadline.text}</p>}
      {card.readiness && (card.readiness.missingMust > 0 || card.readiness.titleMissing) && (
        <p className="m-0 text-muted-foreground">
          {[
            card.readiness.missingMust > 0 ? `${card.readiness.missingMust} zorunlu gereksinim CV'nde görünmüyor` : null,
            card.readiness.titleMissing ? "ilandaki unvan CV'nde geçmiyor" : null,
          ]
            .filter(Boolean)
            .join("; ")}
          .
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={resultPath(card.analysisId)}
          className="group flex items-start gap-3 rounded-lg border p-4 no-underline transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-foreground">Analiz sonucu</span>
            <span className="block text-muted-foreground">Gereksinimler, eksik kavramlar, ilan metni</span>
          </span>
        </Link>
        {card.adaptation ? (
          <Link
            href={`/adapt/${card.adaptation.id}`}
            className="group flex items-start gap-3 rounded-lg border p-4 no-underline transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">Uyarlanmış CV</span>
              <span className="block text-muted-foreground">CV, ön yazı ve form yanıtları</span>
            </span>
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
        <p role="alert" className="m-0 text-destructive">
          {adaptError}
        </p>
      )}
    </div>
  )
}

function MessagesTab({ card }: { card: BoardCard }) {
  return (
    <div className="text-sm">
      <p className="m-0 text-muted-foreground">
        Taslaklar gönderdiğin CV&apos;den ve ön yazından; biz göndermiyoruz, kopyalayıp kendin gönderirsin.
      </p>
      <FollowUpPanel card={card} />
      <OutreachPanel card={card} />
    </div>
  )
}

function InterviewTab({ card, onUpdate }: { card: BoardCard; onUpdate: (change: CardChange) => void }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
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
          <Link href={`/applications/${card.analysisId}/mulakat`}>
            <MessagesSquare aria-hidden />
            Mülakat hazırlığı
            <span className="font-normal text-muted-foreground">· sorular, cevap iskeletleri, pratik</span>
          </Link>
        </Button>
      ) : (
        <p className="m-0 text-muted-foreground">Aşamayı &quot;Mülakat&quot; yapınca hazırlık paketi açılır.</p>
      )}
    </div>
  )
}

function NoteTab({ card, onUpdate }: { card: BoardCard; onUpdate: (change: CardChange) => void }) {
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
        rows={6}
        placeholder="Görüştüğün kişi, şirketin ürünleri, soracağın sorular…"
        aria-label="Not"
        aria-invalid={errors.note ? true : undefined}
      />
      {errors.note && (
        <p role="alert" className="mt-1 text-xs text-brand-amber">
          {errors.note.message}
        </p>
      )}
      <p className="m-0 mt-1 text-xs text-muted-foreground">{isDirty ? "Kutudan çıkınca kaydedilir." : "Yalnızca sen görürsün."}</p>
    </form>
  )
}
