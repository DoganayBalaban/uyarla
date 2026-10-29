import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { STAGE_COLOR, STAGE_LABEL, type BoardCard } from "@/features/applications/board"
import { cn } from "@/lib/cn"
import { scoreStatus } from "@/lib/scoreStatus"

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/**
 * Son analizler tablosu (DOG-145). Satırın tamamı başvuru detayına götürüyor:
 * pozisyon bağlantısı satırı kaplıyor, klavyede tek durak.
 */
export function RecentAnalysesTable({ cards, totalCount }: { cards: BoardCard[]; totalCount: number }) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle>Son analizler</CardTitle>
        {totalCount > cards.length && (
          <CardAction>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link href="/applications">
                Tümü ({totalCount})
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Pozisyon</TableHead>
              <TableHead>Skor</TableHead>
              <TableHead className="hidden sm:table-cell">Aşama</TableHead>
              <TableHead className="hidden pr-5 text-right sm:table-cell">Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((k) => {
              const state = k.score === null ? null : scoreStatus(k.score, k.scoringRevision)
              return (
                <TableRow key={k.analysisId} className="relative">
                  <TableCell className="max-w-0 pl-5 sm:w-1/2">
                    <Link
                      href={`/applications/${k.analysisId}`}
                      className="block truncate font-medium text-foreground no-underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {k.position}
                    </Link>
                    {k.company && <span className="block truncate text-xs text-muted-foreground">{k.company}</span>}
                  </TableCell>
                  <TableCell>
                    {state && k.score !== null ? (
                      <span
                        className={cn("inline-flex items-baseline gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", state.bgClass, state.textClass)}
                      >
                        <span className="tabular-nums">{k.score}</span>
                        <span className="hidden md:inline">· {state.label}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[k.stage])} />
                      {STAGE_LABEL[k.stage]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden pr-5 text-right text-muted-foreground tabular-nums sm:table-cell">
                    {DATE_FORMAT.format(new Date(k.createdAt))}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
