"use client"

import Link from "next/link"
import { CalendarDays, MessagesSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useApplicationCards } from "@/features/applications/api"
import { STAGE_LABEL, type BoardCard } from "@/features/applications/board"

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" })

/** Mülakat ve teklif aşamasındakiler; tarihi yakın olan önde, tarihsizler sonda. */
export function interviewCards(cards: BoardCard[]): BoardCard[] {
  return cards
    .filter((c) => c.stage === "interview" || c.stage === "offer")
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage === "interview" ? -1 : 1
      if (a.interviewAt && b.interviewAt) return a.interviewAt.localeCompare(b.interviewAt)
      return a.interviewAt ? -1 : b.interviewAt ? 1 : 0
    })
}

/**
 * Mülakatlar sayfası (DOG-144): ilk sürüm yalnızca liste ve hazırlığa
 * bağlantı. Takvim ve hazırlık durumu DOG-152'de.
 */
export function InterviewList() {
  const { data, isPending } = useApplicationCards()

  if (isPending) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const list = interviewCards(data ?? [])
  if (list.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MessagesSquare className="size-6" aria-hidden />
          </span>
          <p className="m-0 mt-4 font-semibold">Mülakat aşamasında başvurun yok.</p>
          <p className="m-0 mt-1 max-w-sm text-sm text-muted-foreground">
            Panoda bir başvuruyu Mülakat sütununa taşıdığında hazırlığı burada başlar.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/applications">Başvurulara git</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {list.map((c) => (
        <li key={c.analysisId}>
          <Card className="py-0">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate font-semibold">{c.position}</p>
                <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {c.company && <span>{c.company}</span>}
                  {c.interviewAt && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {DATE_FORMAT.format(new Date(`${c.interviewAt}T12:00:00`))}
                    </span>
                  )}
                </p>
              </div>
              <Badge variant={c.stage === "offer" ? "default" : "secondary"}>{STAGE_LABEL[c.stage]}</Badge>
              <Button asChild size="sm">
                <Link href={`/applications/${c.analysisId}/mulakat`}>Hazırlan</Link>
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
