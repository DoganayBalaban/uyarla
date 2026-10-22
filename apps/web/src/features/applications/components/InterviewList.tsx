"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, CalendarDays, CalendarPlus, ChevronDown, CircleCheck, LoaderCircle, MessagesSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useApplicationCards, useUpdateCard } from "@/features/applications/api"
import { STAGE_COLOR, STAGE_LABEL, type BoardCard, type PrepStatus } from "@/features/applications/board"
import { daysLabel, interviewGroups } from "@/features/applications/interviews"
import { cn } from "@/lib/cn"

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" })
const day = (date: string) => DATE_FORMAT.format(new Date(`${date}T00:00:00Z`))

const PREP: Record<PrepStatus | "none", { label: string; className: string }> = {
  none: { label: "Hazırlık yok", className: "text-muted-foreground" },
  running: { label: "Hazırlanıyor", className: "text-primary" },
  ready: { label: "Hazırlık hazır", className: "text-brand-green dark:text-[#4ade80]" },
  failed: { label: "Hazırlık yazılamadı", className: "text-brand-amber" },
}

/**
 * Mülakatlar merkezi (DOG-152): yaklaşanlar tarihe göre, tarihsizler ayrı,
 * teklif ve ret katlanır geçmişte. Hazırlık durumu satırda.
 */
export function InterviewList() {
  const { data, isPending } = useApplicationCards()
  const updateCard = useUpdateCard()

  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const { upcoming, undated, past } = interviewGroups(data ?? [])
  if (upcoming.length + undated.length + past.length === 0) {
    return (
      <Card className="items-center border-dashed py-10 text-center shadow-none">
        <CardContent className="flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MessagesSquare className="size-6" aria-hidden />
          </span>
          <p className="m-0 mt-4 font-semibold">Mülakat aşamasında başvurun yok.</p>
          <p className="m-0 mt-1 max-w-sm text-sm text-muted-foreground">
            Bir başvuruyu Mülakat aşamasına alınca burada görünür; olası sorular ve cevap iskeletleri hazırlanır.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/applications">Başvurulara git</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <Group title="Yaklaşan mülakatlar" count={upcoming.length}>
          {upcoming.map(({ card, days }, i) => (
            <Row key={card.analysisId} card={card} index={i}>
              <Badge
                variant="secondary"
                className={cn("tabular-nums", days <= 1 ? "bg-brand-amber/15 text-brand-amber" : "bg-primary/10 text-primary")}
              >
                {daysLabel(days)}
              </Badge>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden />
                {day(card.interviewAt!)}
              </span>
            </Row>
          ))}
        </Group>
      )}

      {undated.length > 0 && (
        <Group title="Günü belli olmayanlar" count={undated.length} hint="Günü ekle; yaklaşınca Genel bakış'ta hatırlatalım.">
          {undated.map((card, i) => (
            <Row key={card.analysisId} card={card} index={i}>
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarPlus className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Mülakat gününü ekle</span>
                <Input
                  type="date"
                  aria-label={`${card.position} mülakat günü`}
                  className="h-8 w-auto"
                  onChange={(e) => e.target.value && updateCard.mutate({ analysisId: card.analysisId, change: { interviewAt: e.target.value } })}
                />
              </label>
            </Row>
          ))}
        </Group>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-base font-semibold">
            Geçmiş
            <Badge variant="secondary" className="tabular-nums">
              {past.length}
            </Badge>
            <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="m-0 mt-3 list-none space-y-2.5 p-0">
            {past.map((card, i) => (
              <Row key={card.analysisId} card={card} index={i} muted>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[card.stage])} />
                  {card.stage === "interview" ? "Günü geçti" : STAGE_LABEL[card.stage]}
                  {card.interviewAt && ` · ${day(card.interviewAt)}`}
                </span>
              </Row>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Group({ title, count, hint, children }: { title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold">
        {title}
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      </h2>
      {hint && <p className="m-0 mt-1 text-sm text-muted-foreground">{hint}</p>}
      <ul className="m-0 mt-3 list-none space-y-2.5 p-0">{children}</ul>
    </section>
  )
}

function Row({ card, index, muted = false, children }: { card: BoardCard; index: number; muted?: boolean; children: React.ReactNode }) {
  const reducedMotion = useReducedMotion() ?? false
  const prep = PREP[card.prep ?? "none"]
  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: reducedMotion ? 0 : index * 0.04 }}
    >
      <Card className={cn("py-0 shadow-xs", muted && "bg-muted/30 shadow-none")}>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
          <div className="min-w-0 flex-1 basis-56">
            <Link href={`/applications/${card.analysisId}`} className="block truncate font-medium text-foreground no-underline hover:text-primary hover:underline">
              {card.position}
            </Link>
            <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {card.company && <span>{card.company}</span>}
              {!muted && (
                <span className={cn("inline-flex items-center gap-1 font-medium", prep.className)}>
                  {card.prep === "running" ? (
                    <LoaderCircle className="size-3 motion-safe:animate-spin" aria-hidden />
                  ) : card.prep === "ready" ? (
                    <CircleCheck className="size-3" aria-hidden />
                  ) : null}
                  {prep.label}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">{children}</div>
          {card.stage === "interview" && (
            <Button asChild size="sm" variant={card.prep === "ready" ? "outline" : "default"} className="ml-auto">
              <Link href={`/applications/${card.analysisId}/mulakat`}>
                {card.prep === "ready" ? "Hazırlığa git" : "Hazırlan"}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.li>
  )
}
