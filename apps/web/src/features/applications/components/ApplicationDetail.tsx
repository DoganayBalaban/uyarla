"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/cn"
import { apiErrorBody, apiStatus } from "@/lib/api"
import { loginPath } from "@/lib/returnPath"
import { resultPath } from "@/features/analysis/paths"
import { startAdaptation } from "@/features/adaptation/api"
import { plansPath } from "@/features/billing/paywall"
import { useApplicationCards, useUpdateCard, type CardChange } from "@/features/applications/api"
import {
  STAGES,
  STAGE_LABEL,
  NOTE_MAX_LENGTH,
  deadlineBadge,
  scoreBadge,
  shouldAskBeforeApplying,
  type BoardCard,
  type Stage,
} from "@/features/applications/board"
import { noteFormSchema, type NoteFormValues } from "@/features/applications/schema"
import { FollowUpPanel, OutreachPanel } from "@/features/applications/components/FollowUpPanel"
import { ApplyCheck } from "@/features/applications/components/ApplyCheck"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" })

type Tab = "summary" | "messages" | "interview" | "note"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "summary", label: "Özet" },
  { id: "messages", label: "Mesajlar" },
  { id: "interview", label: "Mülakat" },
  { id: "note", label: "Not" },
]

const link = "font-semibold text-brand-blue no-underline hover:underline dark:text-brand-blue-light"

/**
 * Başvuru detayı (DOG-138): bir başvuruya ait her şey tek sayfada, sekmelerle.
 * Kart sadeleşti; not, mesajlar ve mülakat buraya taşındı. Veri panonun
 * sorgusundan: burada yapılan değişiklik panoda da aynı önbellekten görünüyor.
 */
export function ApplicationDetail({ analysisId }: { analysisId: string }) {
  const cardsQuery = useApplicationCards()
  const updateCard = useUpdateCard()
  const [tab, setTab] = useState<Tab>("summary")
  const [askApply, setAskApply] = useState(false)

  if (cardsQuery.isPending) return <LoaderCircle className="size-5 text-muted-foreground motion-safe:animate-spin" aria-hidden />
  if (cardsQuery.isError) {
    return apiStatus(cardsQuery.error) === 401 ? (
      <p className="text-muted-foreground">
        Başvurunu görmek için <Link href={loginPath(`/applications/${analysisId}`)}>giriş yap</Link>.
      </p>
    ) : (
      <p role="alert" className="flex items-center gap-2 text-brand-red dark:text-[#f87171]">
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
    <div>
      <Link href="/applications" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Başvuru panosu
      </Link>
      <h1 className="m-0 mt-4 text-3xl">{card.position}</h1>
      <p className="m-0 mt-1 text-muted-foreground">
        {[card.company, `analiz ${DATE.format(new Date(card.createdAt))}`].filter(Boolean).join(" · ")}
      </p>

      <div role="tablist" aria-label="Başvuru" className="mt-6 inline-flex flex-wrap rounded-button bg-background p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-[8px] px-3.5 py-1.5 font-medium transition",
              tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="mt-4 rounded-card border border-border bg-card p-5 sm:p-6">
        {tab === "summary" && <SummaryTab card={card} onUpdate={update} />}
        {tab === "messages" && <MessagesTab card={card} />}
        {tab === "interview" && <InterviewTab card={card} onUpdate={update} />}
        {tab === "note" && <NoteTab card={card} onUpdate={update} />}
      </section>

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

function SummaryTab({ card, onUpdate }: { card: BoardCard; onUpdate: (change: CardChange) => void }) {
  const [adapting, setAdapting] = useState(false)
  const [adaptError, setAdaptError] = useState<string | null>(null)
  const router = useRouter()
  const badge = card.score === null ? null : scoreBadge(card.score)
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
      <div className="flex flex-wrap items-center gap-3">
        {badge && card.score !== null && (
          <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${badge.cls}`} title="ATS uyum skoru">
            {card.score} · {badge.text}
          </span>
        )}
        <label className="flex items-center gap-2 text-muted-foreground">
          Aşama
          <select
            value={card.stage}
            onChange={(e) => onUpdate({ stage: e.target.value as Stage })}
            className="rounded-button border border-border bg-card px-2 py-1 font-medium text-foreground"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {deadline && <span className="text-muted-foreground">{deadline.text}</span>}
      </div>
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
      <ul className="m-0 list-none space-y-2 p-0">
        <li>
          <Link href={resultPath(card.analysisId)} className={link}>
            Analiz sonucu
          </Link>
          <span className="text-muted-foreground"> · gereksinimler, eksik kavramlar, ilan metni</span>
        </li>
        <li>
          {card.adaptation ? (
            <>
              <Link href={`/adapt/${card.adaptation.id}`} className={link}>
                Uyarlanmış CV
              </Link>
              <span className="text-muted-foreground"> · CV, ön yazı ve form yanıtları</span>
            </>
          ) : (
            <button type="button" onClick={() => void adapt()} disabled={adapting} className={cn(link, "disabled:opacity-50")}>
              {adapting ? "Hazırlanıyor…" : "CV'ni bu ilana uyarla"}
            </button>
          )}
        </li>
      </ul>
      {adaptError && (
        <p role="alert" className="m-0 text-brand-red dark:text-[#f87171]">
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
      <label className="flex items-center gap-2 text-muted-foreground">
        Mülakat günü
        <input
          type="date"
          value={card.interviewAt ?? ""}
          onChange={(e) => onUpdate({ interviewAt: e.target.value || null })}
          className="rounded-button border border-border bg-card px-2 py-1 text-foreground"
        />
      </label>
      {card.stage === "interview" ? (
        <p className="m-0">
          <Link href={`/applications/${card.analysisId}/mulakat`} className={link}>
            Mülakat hazırlığı
          </Link>
          <span className="text-muted-foreground"> · olası sorular, cevap iskeletleri ve yazılı pratik</span>
        </p>
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
      <textarea
        maxLength={NOTE_MAX_LENGTH}
        {...register("note", { onBlur: () => void save() })}
        rows={6}
        placeholder="Görüştüğün kişi, şirketin ürünleri, soracağın sorular…"
        aria-label="Not"
        aria-invalid={errors.note ? true : undefined}
        className="w-full rounded-button border border-border bg-background p-2.5 dark:bg-white/5"
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
