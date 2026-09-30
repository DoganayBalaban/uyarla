"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
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
import { resultPath } from "@/features/analysis/activeAnalysis"
import { PageHeader } from "@/components/layout/PageShell"
import {
  STAGES,
  STAGE_LABEL,
  STAGE_COLOR,
  NOTE_MAX_LENGTH,
  groupByStage,
  type Stage,
  type BoardCard,
} from "@/features/applications/board"

type LoadState =
  | { state: "loading" }
  | { state: "login" }
  | { state: "error"; messageText: string }
  | { state: "ready"; cards: BoardCard[] }

/** Skor yalnızca renkle değil etiketle de (rehber §9.2). */
function scoreLabel(scoreValue: number): { text: string; cls: string } {
  // Koyu temada durum renklerinin açık tonları: AA kontrastı için.
  if (scoreValue >= 70) return { text: "Yüksek", cls: "bg-yesil/10 text-yesil dark:text-[#4ade80]" }
  if (scoreValue >= 40) return { text: "Orta", cls: "bg-kehribar/15 text-kehribar" }
  return { text: "Düşük", cls: "bg-kirmizi/10 text-kirmizi dark:bg-kirmizi/20 dark:text-[#f87171]" }
}


/** Sürükle-bırak verisinin türü; başka sürüklemelerle karışmasın. */
const DRAG_TYPE = "application/x-uyarla-kart"

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/** Sütun başlığının altındaki kısa metin; rehber §6.2 tonunda. */
const COLUMN_HINT: Partial<Record<Stage, string>> = {
  saved: "Skorunu aldın, henüz başvurmadın.",
  rejected: "Bu olmadı, olur.",
  offer: "Tebrikler!",
}

export function ApplicationBoard() {
  const [loadState, setLoadState] = useState<LoadState>({ state: "loading" })
  const [dropTarget, setDropTarget] = useState<Stage | null>(null)
  const reducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/applications")
      if (response.status === 401) return setLoadState({ state: "login" })
      if (!response.ok) {
        return setLoadState({ state: "error", messageText: "Panonu yükleyemedik. Sayfayı yenileyip tekrar dener misin?" })
      }
      const { cards } = (await response.json()) as { cards: BoardCard[] }
      setLoadState({ state: "ready", cards })
    })()
  }, [])

  /** İyimser güncelleme: kart hemen yer değiştiriyor, hata olursa geri alınıyor. */
  async function refresh(analysisId: string, change: { stage?: Stage; note?: string }) {
    if (loadState.state !== "ready") return
    const previous = loadState.cards
    setLoadState({
      state: "ready",
      cards: previous.map((k) =>
        k.analysisId === analysisId
          ? {
              ...k,
              ...(change.stage && { stage: change.stage, stageChangedAt: new Date().toISOString() }),
              ...(change.note !== undefined && { noteText: change.note || null }),
            }
          : k,
      ),
    })
    const response = await fetch(`/api/applications/${analysisId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(change),
    })
    if (!response.ok) setLoadState({ state: "ready", cards: previous })
  }

  if (loadState.state === "loading") return <BoardSkeleton />
  if (loadState.state === "error") {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-kart border border-cizgi bg-kart p-5 text-kirmizi dark:text-[#f87171]">
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        {loadState.messageText}
      </p>
    )
  }
  if (loadState.state === "login") {
    return (
      <div className="mx-auto max-w-md rounded-kart border border-cizgi bg-kart p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
          <LayoutGrid className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Başvuru panon</h1>
        <p className="mt-2 text-sm text-gri">
          Hangi ilana hangi CV ile başvurduğunu görmek için giriş yap. Kayıtsız yaptığın
          analizler hesabına taşınır.
        </p>
        <Link
          href={loginPath("/applications")}
          className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
        >
          Giriş yap
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    )
  }

  const { cards } = loadState
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
            className="inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white no-underline shadow-sm shadow-mavi/30 transition hover:bg-mavi/90"
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
            <div key={labelText} className="rounded-kart border border-cizgi bg-kart px-4 py-3">
              <dt className="text-xs font-semibold text-gri">{labelText}</dt>
              <dd className="m-0 font-baslik text-2xl font-extrabold tabular-nums">{count}</dd>
            </div>
          ))}
        </dl>
      )}

      {cards.length === 0 ? (
        <div className="mt-10 rounded-kart border border-dashed border-cizgi bg-kart/60 p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
            <Inbox className="size-6" aria-hidden />
          </span>
          {/* Rehber §10.2: boş pano metni, birebir. */}
          <p className="m-0 mt-4 font-baslik text-xl font-extrabold">Henüz başvuru yok.</p>
          <p className="mt-2 text-gri">İlk ilanını yapıştır, birlikte başlayalım.</p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
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
                if (card && card.stage !== cardStage) void refresh(id, { stage: cardStage })
              }}
              className={cn(
                "flex flex-col rounded-kart border bg-metin/[0.025] p-2.5 transition-colors",
                dropTarget === cardStage ? "border-mavi/50 bg-mavi/[0.06]" : "border-cizgi",
              )}
            >
              <header className="px-1.5 pt-1 pb-3">
                <h2 className="m-0 flex items-center gap-2 text-sm">
                  <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[cardStage])} />
                  {STAGE_LABEL[cardStage]}
                  <span className="ml-auto rounded-full bg-kart px-2 py-0.5 text-xs font-semibold text-gri tabular-nums">
                    {columns[cardStage].length}
                  </span>
                </h2>
                {COLUMN_HINT[cardStage] && columns[cardStage].length > 0 && (
                  <p className="m-0 mt-1 text-xs text-gri">{COLUMN_HINT[cardStage]}</p>
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
                  <p className="m-0 grid flex-1 place-items-center rounded-buton border border-dashed border-cizgi px-3 py-5 text-center text-xs text-gri">
                    Kartı buraya bırak
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** Yüklenirken sütunların kabaca şekli. */
function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Panon yükleniyor">
      <div className="h-8 w-56 rounded-buton bg-metin/[0.06] motion-safe:animate-pulse" />
      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((a, i) => (
          <div key={a} className="space-y-2.5 rounded-kart border border-cizgi p-2.5">
            <div className="h-4 w-24 rounded bg-metin/[0.06]" />
            {Array.from({ length: i < 2 ? 2 : 1 }, (_, j) => (
              <div key={j} className="h-24 rounded-buton bg-metin/[0.05] motion-safe:animate-pulse" />
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
  onUpdate: (id: string, d: { stage?: Stage; note?: string }) => Promise<void>
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNoteText] = useState(card.noteText ?? "")
  const [adapting, setAdapting] = useState(false)
  const labelText = card.score === null ? null : scoreLabel(card.score)

  async function adapt() {
    setAdapting(true)
    const response = await fetch("/api/adapt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysisId: card.analysisId }),
    })
    const parsed = (await response.json()) as { adaptationId?: string }
    if (response.ok && parsed.adaptationId) {
      window.location.href = `/adapt/${parsed.adaptationId}`
      return
    }
    setAdapting(false)
  }

  function saveNote() {
    setNoteOpen(false)
    if (note.trim() !== (card.noteText ?? "")) void onUpdate(card.analysisId, { note: note.trim() })
  }

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, card.analysisId)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="group rounded-buton border border-cizgi bg-kart p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-mavi/30 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        <h3 className="m-0 flex-1 text-[15px] leading-snug">
          {/* Analiz sonucuna kalıcı adres; önceden sonuca geri dönmenin yolu yoktu (K3). */}
          <Link
            href={resultPath(card.analysisId)}
            draggable={false}
            className="text-metin no-underline hover:text-mavi hover:underline"
          >
            {card.position}
          </Link>
        </h3>
        <GripVertical
          className="mt-0.5 size-4 shrink-0 cursor-grab text-gri opacity-0 transition group-hover:opacity-100"
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
        <span className="inline-flex items-center gap-1 text-xs text-gri">
          <CalendarDays className="size-3.5" aria-hidden />
          {DATE_FORMAT.format(new Date(card.createdAt))}
        </span>
      </div>

      {noteOpen ? (
        <textarea
          autoFocus
          value={note}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={saveNote}
          rows={3}
          placeholder="Şirket, görüştüğün kişi, tarih…"
          className="mt-3 w-full rounded-buton border border-cizgi bg-zemin p-2 text-sm dark:bg-white/5"
        />
      ) : card.noteText ? (
        <button
          onClick={() => setNoteOpen(true)}
          className="mt-3 block w-full rounded-buton bg-zemin p-2 text-left text-sm text-metin dark:bg-white/5"
        >
          {card.noteText}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cizgi pt-3">
        <label className="sr-only" htmlFor={`asama-${card.analysisId}`}>
          Aşama
        </label>
        <select
          id={`asama-${card.analysisId}`}
          value={card.stage}
          onChange={(e) => void onUpdate(card.analysisId, { stage: e.target.value as Stage })}
          className="rounded-buton border border-cizgi bg-kart px-2 py-1 text-xs font-medium"
        >
          {STAGES.map((a) => (
            <option key={a} value={a}>
              {STAGE_LABEL[a]}
            </option>
          ))}
        </select>

        {card.adaptation ? (
          <Link href={`/adapt/${card.adaptation.id}`} className="text-sm font-semibold text-mavi dark:text-[#8ea2ff]">
            Uyarlamayı aç
          </Link>
        ) : (
          <button
            onClick={() => void adapt()}
            disabled={adapting}
            className="text-sm font-semibold text-mavi dark:text-[#8ea2ff] disabled:opacity-50"
          >
            {adapting ? "Hazırlanıyor…" : "Uyarla"}
          </button>
        )}

        {!noteOpen && !card.noteText && (
          <button
            onClick={() => setNoteOpen(true)}
            className="ml-auto inline-flex items-center gap-1 text-sm text-gri hover:text-metin"
          >
            <StickyNote className="size-3.5" aria-hidden />
            Not ekle
          </button>
        )}
      </div>
    </article>
  )
}
