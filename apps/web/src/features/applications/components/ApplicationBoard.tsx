"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  GripVertical,
  Inbox,
  LayoutGrid,
  Plus,
  StickyNote,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { loginPath } from "@/lib/returnPath"
import { resultPath } from "@/features/analysis/paths"
import { apiErrorBody, apiStatus } from "@/lib/api"
import { PageHeader } from "@/components/layout/PageShell"
import { startAdaptation } from "@/features/adaptation/api"
import { plansPath } from "@/features/billing/paywall"
import { useApplicationCards, useUpdateCard, type CardChange } from "@/features/applications/api"
import {
  STAGES,
  STAGE_LABEL,
  STAGE_COLOR,
  NOTE_MAX_LENGTH,
  deadlineBadge,
  groupByStage,
  scoreBadge,
  shouldAskBeforeApplying,
  type Stage,
  type BoardCard,
} from "@/features/applications/board"
import { noteFormSchema, type NoteFormValues } from "@/features/applications/schema"
import { FollowUpPanel, OutreachPanel } from "@/features/applications/components/FollowUpPanel"

/** Sürükle-bırak verisinin türü; başka sürüklemelerle karışmasın. */
const DRAG_TYPE = "application/x-uyarla-kart"

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/**
 * Sütun başlığının altındaki kısa metin; rehber §6.2 tonunda. Her sütunda
 * kartın o aşamada sunduğu şeye yönlendiriyor (DOG-135); hatırlatma e-postası
 * anılmıyor, ürün e-postaları açık değil (DOG-130).
 */
const COLUMN_HINT: Record<Stage, string> = {
  saved: "Skorunu aldın, henüz başvurmadın.",
  applied: "Cevap gelmediyse kartta takip mesajı yazabilirsin.",
  interview: "Mülakat gününü ekle; kartta hazırlık paketi ve teşekkür notu var.",
  offer: "Tebrikler!",
  rejected: "Bu olmadı, olur.",
}

export function ApplicationBoard() {
  const cardsQuery = useApplicationCards()
  const updateCard = useUpdateCard()
  const [dropTarget, setDropTarget] = useState<Stage | null>(null)
  const reducedMotion = useReducedMotion() ?? false
  // "Başvuruldu"ya alınan ama hazır olmayan kart (DOG-91).
  const [askApply, setAskApply] = useState<BoardCard | null>(null)

  function refresh(analysisId: string, change: CardChange) {
    const card = cardsQuery.data?.find((k) => k.analysisId === analysisId)
    if (card && change.stage && shouldAskBeforeApplying(card, change.stage)) {
      setAskApply(card)
      return
    }
    updateCard.mutate({ analysisId, change })
  }

  if (cardsQuery.isPending) return <BoardSkeleton />
  if (cardsQuery.isError && apiStatus(cardsQuery.error) !== 401) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-card border border-border bg-card p-5 text-brand-red dark:text-[#f87171]">
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        Panonu yükleyemedik. Sayfayı yenileyip tekrar dener misin?
      </p>
    )
  }
  if (cardsQuery.isError) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
          <LayoutGrid className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Başvuru panon</h1>
        <p className="mt-2 text-sm text-muted">
          Hangi ilana hangi CV ile başvurduğunu görmek için giriş yap. Kayıtsız yaptığın
          analizler hesabına taşınır.
        </p>
        <Link
          href={loginPath("/applications")}
          className="mt-6 inline-flex items-center gap-2 rounded-button bg-brand-blue px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-brand-blue/30"
        >
          Giriş yap
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    )
  }

  const cards = cardsQuery.data
  const columns = groupByStage(cards)
  const appliedCount = cards.filter((k) => k.stage !== "saved").length
  const interviewCount = columns.interview.length + columns.offer.length

  return (
    <div>
      <PageHeader
        title="Başvuru panon"
        description={
          cards.length === 0
            ? "Her analiz buraya bir kart olarak düşer."
            : "Kartları sürükleyerek ya da aşama menüsünden taşıyabilirsin."
        }
        action={
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-5 py-2.5 font-semibold text-white no-underline shadow-sm shadow-brand-blue/30 transition hover:bg-brand-blue/90"
          >
            <Plus className="size-4" aria-hidden />
            Yeni analiz
          </Link>
        }
        className="mb-0"
      />

      {cards.length > 0 && (
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
          {(
            [
              ["İlan", cards.length],
              ["Başvuru", appliedCount],
              ["Mülakat", interviewCount],
            ] as const
          ).map(([labelText, count]) => (
            <div key={labelText} className="rounded-card border border-border bg-card px-4 py-3">
              <dt className="text-xs font-semibold text-muted">{labelText}</dt>
              <dd className="m-0 font-heading text-2xl font-extrabold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      )}

      {cards.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-border bg-card/60 p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
            <Inbox className="size-6" aria-hidden />
          </span>
          {/* Rehber §10.2: boş pano metni, birebir. */}
          <p className="m-0 mt-4 font-heading text-xl font-extrabold">Henüz başvuru yok.</p>
          <p className="mt-2 text-muted">İlk ilanını yapıştır, birlikte başlayalım.</p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex items-center gap-2 rounded-button bg-brand-blue px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-brand-blue/30"
          >
            İlk analizini yap
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)] md:overflow-x-auto md:pb-2 xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
          {STAGES.map((cardStage) => (
            <section
              key={cardStage}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                e.preventDefault()
                setDropTarget(cardStage)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDropTarget(null)
                const id = e.dataTransfer.getData(DRAG_TYPE)
                const card = cards.find((k) => k.analysisId === id)
                if (card && card.stage !== cardStage) refresh(id, { stage: cardStage })
              }}
              className={cn(
                "flex flex-col rounded-card border bg-foreground/[0.025] p-2.5 transition-colors",
                dropTarget === cardStage ? "border-brand-blue/50 bg-brand-blue/[0.06]" : "border-border",
              )}
            >
              <header className="px-1.5 pt-1 pb-3">
                <h2 className="m-0 flex items-center gap-2 text-sm">
                  <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[cardStage])} />
                  {STAGE_LABEL[cardStage]}
                  <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted tabular-nums">
                    {columns[cardStage].length}
                  </span>
                </h2>
                {columns[cardStage].length > 0 && (
                  <p className="m-0 mt-1 text-xs text-muted">{COLUMN_HINT[cardStage]}</p>
                )}
              </header>
              <div className="flex min-h-16 flex-1 flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {columns[cardStage].map((k) => (
                    <motion.div
                      key={k.analysisId}
                      layout={!reducedMotion}
                      initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BoardCardView card={k} onUpdate={refresh} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {columns[cardStage].length === 0 && (
                  <p className="m-0 grid flex-1 place-items-center rounded-button border border-dashed border-border px-3 py-5 text-center text-xs text-muted">
                    Kartı buraya bırak
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      {askApply && (
        <ApplyCheck
          card={askApply}
          onApply={() => {
            updateCard.mutate({ analysisId: askApply.analysisId, change: { stage: "applied" } })
            setAskApply(null)
          }}
          onClose={() => setAskApply(null)}
        />
      )}
    </div>
  )
}

/**
 * Başvuru kapısı (DOG-91): skor düşükken "önce uyarlamak ister misin?".
 * Durdurmuyor; uyarlama "Uyarla"daki akışla (giriş ve paket dönüşü dahil).
 */
function ApplyCheck({ card, onApply, onClose }: { card: BoardCard; onApply: () => void; onClose: () => void }) {
  const r = card.readiness!
  const gaps = [
    r.missingMust > 0 ? `${r.missingMust} zorunlu gereksinim CV'nde görünmüyor` : null,
    r.titleMissing ? "ilandaki unvan CV'nde geçmiyor" : null,
  ].filter(Boolean)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-check-title"
        className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="apply-check-title" className="m-0 text-lg">
          Önce uyarlamak ister misin?
        </h2>
        <p className="mt-2 text-sm text-muted">
          {card.position}: {gaps.join("; ")}. Deneyiminde varsa uyarlamada görünür kılabiliriz; olmayan bir şeyi
          eklemiyoruz.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/analyze?uyarla=${encodeURIComponent(card.analysisId)}`}
            autoFocus
            className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-4 py-2.5 font-semibold text-white no-underline"
          >
            Önce uyarla
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onApply}
            className="rounded-button border border-border px-4 py-2.5 text-sm font-semibold hover:border-foreground/25"
          >
            Yine de başvurdum
          </button>
          <button type="button" onClick={onClose} className="px-3 py-2.5 text-sm font-semibold text-muted">
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  )
}

/** Yüklenirken sütunların kabaca şekli. */
function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Panon yükleniyor">
      <div className="h-8 w-56 rounded-button bg-foreground/[0.06] motion-safe:animate-pulse" />
      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((a, i) => (
          <div key={a} className="space-y-2.5 rounded-card border border-border p-2.5">
            <div className="h-4 w-24 rounded bg-foreground/[0.06]" />
            {Array.from({ length: i < 2 ? 2 : 1 }, (_, j) => (
              <div key={j} className="h-24 rounded-button bg-foreground/[0.05] motion-safe:animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardCardView({
  card,
  onUpdate,
}: {
  card: BoardCard
  onUpdate: (id: string, change: CardChange) => void
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    values: { note: card.noteText ?? "" },
  })
  const [adapting, setAdapting] = useState(false)
  const [adaptError, setAdaptError] = useState<string | null>(null)
  const router = useRouter()
  const labelText = card.score === null ? null : scoreBadge(card.score)
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
      // Günlük sınır ve diğer hatalar kartta (DOG-80): önceden yutuluyordu,
      // düğme sessizce eski hâline dönüyordu.
      setAdaptError(
        body.code === "daily_cap" && body.error ? body.error : "Uyarlamayı başlatamadık. Birazdan tekrar dener misin?",
      )
      setAdapting(false)
    }
  }

  // Odak kutudan çıkınca kaydediliyor; şemadan geçmeyen not kutuyu açık
  // bırakıp hatayı gösteriyor. Şema metni kırpıyor.
  const saveNote = handleSubmit(({ note }) => {
    setNoteOpen(false)
    if (note !== (card.noteText ?? "")) onUpdate(card.analysisId, { note })
  })

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, card.analysisId)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="group rounded-button border border-border bg-card p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-brand-blue/30 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        <h3 className="m-0 flex-1 text-[15px] leading-snug">
          {/* Analiz sonucuna kalıcı adres; önceden sonuca geri dönmenin yolu yoktu (K3). */}
          <Link
            href={resultPath(card.analysisId)}
            draggable={false}
            className="text-foreground no-underline hover:text-brand-blue hover:underline"
          >
            {card.position}
          </Link>
          {/* Aynı pozisyona farklı şirketlerden başvurular ayrılsın (DOG-64). */}
          {card.company && <span className="mt-0.5 block text-xs font-normal text-muted">{card.company}</span>}
        </h3>
        <GripVertical
          className="mt-0.5 size-4 shrink-0 cursor-grab text-muted opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {labelText && card.score !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${labelText.cls}`}
            title="ATS uyum skoru"
          >
            {card.score} · {labelText.text}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <CalendarDays className="size-3.5" aria-hidden />
          {DATE_FORMAT.format(new Date(card.createdAt))}
        </span>
        {card.interviewAt && (
          <span className="rounded-full bg-brand-amber/10 px-2 py-0.5 text-xs font-semibold text-brand-amber">
            Mülakat {DATE_FORMAT.format(new Date(`${card.interviewAt}T12:00:00`))}
          </span>
        )}
        {/* Son başvuru günü (DOG-120): yalnızca "Kaydedildi"de; yaklaşınca vurgulu. */}
        {deadline && (
          <span
            className={
              deadline.tone === "soon"
                ? "rounded-full bg-brand-red/10 px-2 py-0.5 text-xs font-semibold text-brand-red dark:text-[#f87171]"
                : deadline.tone === "past"
                  ? "rounded-full bg-background px-2 py-0.5 text-xs text-muted line-through decoration-muted/60"
                  : "rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted"
            }
          >
            {deadline.text}
          </span>
        )}
      </div>

      {/* Mülakat günü (DOG-98): aşama "Mülakat" iken ya da tarih girildiyse. */}
      {(card.stage === "interview" || card.interviewAt) && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted">
          Mülakat günü
          <input
            type="date"
            value={card.interviewAt ?? ""}
            onChange={(e) => onUpdate(card.analysisId, { interviewAt: e.target.value || null })}
            className="rounded-button border border-border bg-card px-2 py-1 text-xs text-foreground"
          />
        </label>
      )}

      {noteOpen ? (
        <>
          <textarea
            autoFocus
            maxLength={NOTE_MAX_LENGTH}
            {...register("note", { onBlur: () => void saveNote() })}
            rows={3}
            placeholder="Görüştüğün kişi, şirketin ürünleri, soracağın sorular…"
            aria-invalid={errors.note ? true : undefined}
            className="mt-3 w-full rounded-button border border-border bg-background p-2 text-sm dark:bg-white/5"
          />
          {errors.note && (
            <p role="alert" className="mt-1 text-xs text-brand-amber">
              {errors.note.message}
            </p>
          )}
        </>
      ) : card.noteText ? (
        <button
          onClick={() => setNoteOpen(true)}
          className="mt-3 block w-full rounded-button bg-background p-2 text-left text-sm text-foreground dark:bg-white/5"
        >
          {card.noteText}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label className="sr-only" htmlFor={`asama-${card.analysisId}`}>
          Aşama
        </label>
        <select
          id={`asama-${card.analysisId}`}
          value={card.stage}
          onChange={(e) => onUpdate(card.analysisId, { stage: e.target.value as Stage })}
          className="rounded-button border border-border bg-card px-2 py-1 text-xs font-medium"
        >
          {STAGES.map((a) => (
            <option key={a} value={a}>
              {STAGE_LABEL[a]}
            </option>
          ))}
        </select>

        {card.adaptation ? (
          <Link href={`/adapt/${card.adaptation.id}`} className="text-sm font-semibold text-brand-blue dark:text-brand-blue-light">
            Uyarlamayı aç
          </Link>
        ) : (
          <button
            onClick={() => void adapt()}
            disabled={adapting}
            className="text-sm font-semibold text-brand-blue dark:text-brand-blue-light disabled:opacity-50"
          >
            {adapting ? "Hazırlanıyor…" : "Uyarla"}
          </button>
        )}

        {!noteOpen && !card.noteText && (
          <button
            onClick={() => setNoteOpen(true)}
            className="ml-auto inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <StickyNote className="size-3.5" aria-hidden />
            Not ekle
          </button>
        )}
      </div>
      {adaptError && (
        <p role="alert" className="mt-2 text-sm text-brand-red dark:text-[#f87171]">
          {adaptError}
        </p>
      )}
      {/* Mülakat hazırlık paketi (DOG-118). */}
      {card.stage === "interview" && (
        <Link
          href={`/applications/${card.analysisId}/mulakat`}
          className="mt-2 mr-3 inline-flex text-sm font-semibold text-brand-blue no-underline dark:text-brand-blue-light"
        >
          Mülakat hazırlığı
        </Link>
      )}
      {/* Takip mesajı ya da teşekkür notu taslağı (DOG-117). */}
      <FollowUpPanel card={card} />
      <OutreachPanel card={card} />
    </article>
  )
}
