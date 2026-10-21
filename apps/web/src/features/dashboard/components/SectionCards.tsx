import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CountUp } from "@/components/motion"
import type { DashboardMetrics } from "@/features/dashboard/summary"
import { scoreStatus } from "@/lib/scoreStatus"

/**
 * Genel bakışın özet kartları (DOG-145, dashboard-01 `SectionCards`). Sayılar
 * yalnızca kullanıcının kendi kartlarından; her kartın altında tek satır anlam.
 */
export function SectionCards({ total, metrics }: { total: number; metrics: DashboardMetrics }) {
  const waiting = total - metrics.applied
  const band = metrics.averageScore === null ? null : scoreStatus(metrics.averageScore)
  const cards = [
    {
      label: "Analiz",
      value: total,
      badge: metrics.analysesLast30 > 0 ? `+${metrics.analysesLast30}` : null,
      badgeLabel: "son 30 gün",
      footer:
        metrics.analysesLast30 > 0 ? `Son 30 günde ${metrics.analysesLast30} yeni analiz` : "Son 30 günde yeni analiz yok",
    },
    {
      label: "Başvuru",
      value: metrics.applied,
      footer: waiting > 0 ? `${waiting} ilan başvurunu bekliyor` : "Analiz ettiğin her ilana başvurdun",
    },
    {
      label: "Mülakat ya da teklif",
      value: metrics.positive,
      footer:
        metrics.applied > 0 ? `${metrics.applied} başvurudan ${metrics.positive} tanesi` : "Başvurdukça burada görünecek",
    },
    {
      label: "Ortalama skor",
      value: metrics.averageScore,
      footer: band ? `${band.label} bandında` : "Skorlu analiz yok",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="gap-2 bg-gradient-to-t from-primary/5 to-card py-4 shadow-xs sm:gap-3 sm:py-5">
          <CardHeader className="px-4 sm:px-5">
            <CardDescription>{c.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums sm:text-3xl">
              {c.value === null ? "—" : <CountUp value={c.value} />}
            </CardTitle>
            {c.badge && (
              <CardAction>
                <Badge variant="outline" aria-label={`${c.badgeLabel}: ${c.badge}`}>
                  {c.badge}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardFooter className="px-4 text-xs text-muted-foreground sm:px-5 sm:text-sm">{c.footer}</CardFooter>
        </Card>
      ))}
    </div>
  )
}
