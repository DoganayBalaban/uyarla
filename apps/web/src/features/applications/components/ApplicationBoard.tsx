"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CircleAlert,
  Columns3,
  GripVertical,
  Inbox,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Table2,
} from "lucide-react"
import { AppPageHeader } from "@/components/layout/app-shell/AppPage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/cn"
import { loginPath } from "@/lib/returnPath"
import { apiStatus } from "@/lib/api"
import { useApplicationCards, useUpdateCard, type CardChange } from "@/features/applications/api"
import {
  STAGES,
  STAGE_LABEL,
  STAGE_COLOR,
  deadlineBadge,
  groupByStage,
  scoreBadge,
  shouldAskBeforeApplying,
  type Stage,
  type BoardCard,
} from "@/features/applications/board"
import { ApplyCheck } from "@/features/applications/components/ApplyCheck"
import { StageSelect } from "@/features/applications/components/StageSelect"
import { personalOutcomeSignal } from "@/features/applications/outcomes"
import { filterCards, sortCards, updatedAt, type SortDir, type SortKey } from "@/features/applications/table"

/** Sürükle-bırak verisinin türü; başka sürüklemelerle karışmasın. */
const DRAG_TYPE = "application/x-uyarla-kart"

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })
const day = (date: string) => DATE_FORMAT.format(new Date(`${date}T12:00:00`))

/** Pano ya da tablo; seçim tarayıcıda hatırlanıyor (DOG-148). */
type View = "board" | "table"
const VIEW_KEY = "uyarla:basvuru-gorunumu"

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "table" ? "table" : "board"
  } catch {
    return "board"
  }
}

function saveView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view)
  } catch {
    // Gizli pencere ya da engellenmiş depolama: seçim yalnızca bu oturumda.
  }
}

/**
 * Sütun başlığının altındaki kısa metin; rehber §6.2 tonunda. Her sütunda
 * kartın o aşamada sunduğu şeye yönlendiriyor (DOG-135); hatırlatma e-postası
 * anılmıyor, ürün e-postaları açık değil (DOG-130).
 */
const COLUMN_HINT: Record<Stage, string> = {
  saved: "Skorunu aldın, henüz başvurmadın.",
  applied: "Cevap gelmediyse başvuruyu açıp takip mesajı yazabilirsin.",
  interview: "Başvuruyu aç: mülakat günü, hazırlık paketi ve teşekkür notu orada.",
  offer: "Tebrikler!",
  rejected: "Bu olmadı, olur.",
}

const newAnalysis = (
  <Button asChild>
    <Link href="/analyze">
      <Plus aria-hidden />
      Yeni analiz
    </Link>
  </Button>
)

export function ApplicationBoard() {
  const cardsQuery = useApplicationCards()
  const updateCard = useUpdateCard()
  // "Başvuruldu"ya alınan ama hazır olmayan kart (DOG-91).
  const [askApply, setAskApply] = useState<BoardCard | null>(null)
  const [view, setView] = useState<View>("board")
  // İlk çizim sunucuyla aynı (pano); hatırlanan seçim sonra okunuyor.
  useEffect(() => setView(readView()), [])

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
      <p role="alert" className="flex items-center gap-2 rounded-xl border bg-card p-5 text-destructive">
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        Panonu yükleyemedik. Sayfayı yenileyip tekrar dener misin?
      </p>
    )
  }
  if (cardsQuery.isError) {
    return (
      <Card className="mx-auto max-w-md items-center py-10 text-center">
        <CardContent className="flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <LayoutGrid className="size-6" aria-hidden />
          </span>
          <h1 className="m-0 mt-4 text-xl font-semibold">Başvuru panon</h1>
          <p className="m-0 mt-2 text-sm text-muted-foreground">
            Hangi ilana hangi CV ile başvurduğunu görmek için giriş yap. Kayıtsız yaptığın analizler hesabına taşınır.
          </p>
          <Button asChild className="mt-6">
            <Link href={loginPath("/applications")}>
              Giriş yap
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const cards = cardsQuery.data
  const columns = groupByStage(cards)
  const appliedCount = cards.filter((k) => k.stage !== "saved").length
  const interviewCount = columns.interview.length + columns.offer.length
  // Kendi sonuçlarından sinyal (DOG-124): en az üç başvuru sonuçlanınca.
  const signal = personalOutcomeSignal(cards)

  if (cards.length === 0) {
    return (
      <>
        <AppPageHeader title="Başvurular" description="Her analiz buraya bir kart olarak düşer." actions={newAnalysis} />
        <Card className="items-center border-dashed py-12 text-center shadow-none">
          <CardContent className="flex flex-col items-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Inbox className="size-6" aria-hidden />
            </span>
            {/* Rehber §10.2: boş pano metni, birebir. */}
            <p className="m-0 mt-4 text-lg font-semibold">Henüz başvuru yok.</p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">İlk ilanını yapıştır, birlikte başlayalım.</p>
            <Button asChild className="mt-6">
              <Link href="/analyze">
                İlk analizini yap
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <div>
      <AppPageHeader
        title="Başvurular"
        description="Kartları sürükleyerek ya da aşama menüsünden taşıyabilirsin."
        actions={newAnalysis}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(3,minmax(0,9rem))_minmax(0,1fr)]">
        {(
          [
            ["İlan", cards.length],
            ["Başvuru", appliedCount],
            ["Mülakat", interviewCount],
          ] as const
        ).map(([labelText, count]) => (
          <div key={labelText} className="rounded-xl border bg-gradient-to-t from-primary/5 to-card px-4 py-3 shadow-xs">
            <p className="m-0 text-xs font-medium text-muted-foreground">{labelText}</p>
            <p className="m-0 text-2xl font-semibold tabular-nums">{count}</p>
          </div>
        ))}
        {signal && (
          <div className="col-span-full rounded-xl border bg-card px-4 py-3 text-sm shadow-xs sm:col-span-1">
            <p className="m-0 flex items-center gap-1.5 font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Senin sonuçların
            </p>
            {signal.map((line) => (
              <p key={line} className="m-0 text-muted-foreground">
                {line}
              </p>
            ))}
            <p className="m-0 mt-0.5 text-xs text-muted-foreground">Yalnızca kendi başvuruların; az sayıda başvuruda tesadüf payı büyük.</p>
          </div>
        )}
      </div>

      <Tabs
        value={view}
        onValueChange={(v) => {
          setView(v as View)
          saveView(v as View)
        }}
        className="mt-6 gap-4"
      >
        <TabsList aria-label="Görünüm">
          <TabsTrigger value="board" className="px-3">
            <Columns3 aria-hidden /> Pano
          </TabsTrigger>
          <TabsTrigger value="table" className="px-3">
            <Table2 aria-hidden /> Tablo
          </TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          <BoardColumns cards={cards} onUpdate={refresh} />
        </TabsContent>
        <TabsContent value="table">
          <ApplicationTable cards={cards} onUpdate={refresh} />
        </TabsContent>
      </Tabs>

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

/** Yüklenirken sütunların kabaca şekli. */
function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Panon yükleniyor">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:max-w-md">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {STAGES.map((a, i) => (
          <div key={a} className="space-y-2.5 rounded-xl border p-2.5">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: i < 2 ? 2 : 1 }, (_, j) => (
              <Skeleton key={j} className="h-24 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardColumns({ cards, onUpdate }: { cards: BoardCard[]; onUpdate: (id: string, change: CardChange) => void }) {
  const [dropTarget, setDropTarget] = useState<Stage | null>(null)
  const reducedMotion = useReducedMotion() ?? false
  const columns = groupByStage(cards)
  return (
    <div className="grid gap-4 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)] md:overflow-x-auto md:pb-2 xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
      {STAGES.map((cardStage) => (
        <section
          key={cardStage}
          aria-label={STAGE_LABEL[cardStage]}
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
            if (card && card.stage !== cardStage) onUpdate(id, { stage: cardStage })
          }}
          className={cn(
            "flex flex-col rounded-xl border bg-muted/40 p-2.5 transition-colors",
            dropTarget === cardStage && "border-primary/50 bg-primary/5",
          )}
        >
          <header className="px-1.5 pt-1 pb-3">
            <h2 className="m-0 flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[cardStage])} />
              {STAGE_LABEL[cardStage]}
              <Badge variant="secondary" className="ml-auto tabular-nums">
                {columns[cardStage].length}
              </Badge>
            </h2>
            {columns[cardStage].length > 0 && <p className="m-0 mt-1 text-xs text-muted-foreground">{COLUMN_HINT[cardStage]}</p>}
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
                  <BoardCardView card={k} onUpdate={onUpdate} />
                </motion.div>
              ))}
            </AnimatePresence>
            {columns[cardStage].length === 0 && (
              <p className="m-0 grid flex-1 place-items-center rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
                Kartı buraya bırak
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  const badge = score === null ? null : scoreBadge(score)
  if (!badge || score === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", badge.cls)} title="ATS uyum skoru">
      {score} · {badge.text}
    </span>
  )
}

function DeadlineBadge({ card }: { card: BoardCard }) {
  // Son başvuru günü (DOG-120): yalnızca "Kaydedildi"de; yaklaşınca vurgulu.
  const deadline = deadlineBadge(card)
  if (!deadline) return null
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs",
        deadline.tone === "soon"
          ? "bg-destructive/10 font-semibold text-destructive"
          : deadline.tone === "past"
            ? "bg-muted text-muted-foreground line-through decoration-muted-foreground/60"
            : "bg-muted font-medium text-muted-foreground",
      )}
    >
      {deadline.text}
    </span>
  )
}

function BoardCardView({ card, onUpdate }: { card: BoardCard; onUpdate: (id: string, change: CardChange) => void }) {
  // Not, mesajlar, mülakat ve uyarlama başvuru detayında (DOG-138); kart
  // yalnızca başlık, skor, tarihler ve aşama.
  const detail = `/applications/${encodeURIComponent(card.analysisId)}`
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, card.analysisId)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="group rounded-lg border bg-card p-3.5 shadow-xs transition hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        <h3 className="m-0 flex-1 text-sm leading-snug font-semibold">
          <Link href={detail} draggable={false} className="text-foreground no-underline hover:text-primary hover:underline">
            {card.position}
          </Link>
          {/* Aynı pozisyona farklı şirketlerden başvurular ayrılsın (DOG-64). */}
          {card.company && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{card.company}</span>}
        </h3>
        <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-hidden />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <ScoreBadge score={card.score} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          {DATE_FORMAT.format(new Date(card.createdAt))}
        </span>
        {card.interviewAt && (
          <span className="rounded-full bg-brand-amber/10 px-2 py-0.5 text-xs font-semibold text-brand-amber">Mülakat {day(card.interviewAt)}</span>
        )}
        <DeadlineBadge card={card} />
        {card.noteText && <StickyNote className="size-3.5 text-muted-foreground" aria-label="Notu var" />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <StageSelect value={card.stage} onChange={(stage) => onUpdate(card.analysisId, { stage })} className="h-7 text-xs" />
        <Button asChild variant="ghost" size="sm" className="ml-auto text-primary">
          <Link href={detail} draggable={false}>
            Aç
          </Link>
        </Button>
      </div>
    </article>
  )
}

const COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: "position", label: "Pozisyon" },
  { key: "score", label: "Skor" },
  { key: "stage", label: "Aşama" },
  { key: "deadline", label: "Son başvuru", className: "hidden lg:table-cell" },
  { key: "interviewAt", label: "Mülakat", className: "hidden lg:table-cell" },
  { key: "updated", label: "Güncelleme", className: "hidden xl:table-cell" },
]

/** Tablo görünümü (DOG-148, dashboard-01 veri tablosu): arama, aşama süzgeci, sıralama. */
function ApplicationTable({ cards, onUpdate }: { cards: BoardCard[]; onUpdate: (id: string, change: CardChange) => void }) {
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState<Stage | "all">("all")
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "updated", dir: "desc" })
  const rows = sortCards(filterCards(cards, { query, stage }), sort.key, sort.dir)
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "position" ? "asc" : "desc" }))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:max-w-xs sm:min-w-0 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pozisyon ya da şirket ara"
            aria-label="Başvurularda ara"
            className="pl-8"
          />
        </div>
        <Select value={stage} onValueChange={(v) => setStage(v as Stage | "all")}>
          <SelectTrigger aria-label="Aşamaya göre süz" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Bütün aşamalar</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[s])} />
                {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="m-0 ml-auto text-xs text-muted-foreground tabular-nums">
          {rows.length} / {cards.length} başvuru
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Bu süzgeçte başvuru yok.</p>
      ) : (
        <>
          {/* Geniş ekranda tablo. */}
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((c) => (
                    <TableHead
                      key={c.key}
                      className={cn(c.key === "position" && "pl-4", c.className)}
                      aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleSort(c.key)} className="-ml-2 h-7 px-2 text-xs font-medium">
                        {c.label}
                        {sort.key !== c.key ? (
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                        ) : sort.dir === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden />
                        )}
                      </Button>
                    </TableHead>
                  ))}
                  <TableHead className="w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((card) => (
                  <TableRow key={card.analysisId}>
                    <TableCell className="max-w-72 pl-4">
                      <Link href={`/applications/${card.analysisId}`} className="block truncate font-medium text-foreground no-underline hover:text-primary hover:underline">
                        {card.position}
                      </Link>
                      {card.company && <span className="block truncate text-xs text-muted-foreground">{card.company}</span>}
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={card.score} />
                    </TableCell>
                    <TableCell>
                      <StageSelect value={card.stage} onChange={(s) => onUpdate(card.analysisId, { stage: s })} className="h-7 text-xs" />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                      {card.deadline ? day(card.deadline) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                      {card.interviewAt ? day(card.interviewAt) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground tabular-nums xl:table-cell">
                      {DATE_FORMAT.format(new Date(updatedAt(card)))}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button asChild variant="ghost" size="icon" className="size-7" aria-label={`${card.position} başvurusunu aç`}>
                        <Link href={`/applications/${card.analysisId}`}>
                          <ArrowRight aria-hidden />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Dar ekranda kart listesi. */}
          <ul className="m-0 list-none space-y-2.5 p-0 md:hidden">
            {rows.map((card) => (
              <li key={card.analysisId} className="rounded-lg border bg-card p-3.5 shadow-xs">
                <Link href={`/applications/${card.analysisId}`} className="block font-medium text-foreground no-underline">
                  {card.position}
                </Link>
                {card.company && <span className="block text-xs text-muted-foreground">{card.company}</span>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ScoreBadge score={card.score} />
                  <DeadlineBadge card={card} />
                  {card.interviewAt && (
                    <span className="rounded-full bg-brand-amber/10 px-2 py-0.5 text-xs font-semibold text-brand-amber">Mülakat {day(card.interviewAt)}</span>
                  )}
                  <StageSelect value={card.stage} onChange={(s) => onUpdate(card.analysisId, { stage: s })} className="ml-auto h-7 text-xs" />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
