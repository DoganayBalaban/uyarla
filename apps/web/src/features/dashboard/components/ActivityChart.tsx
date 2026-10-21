"use client"

import { useState } from "react"
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { bucketTimeline, type TimelinePoint } from "@/features/dashboard/summary"

const RANGES = [
  { days: 7, label: "7 gün", phrase: "Son 7 günde" },
  { days: 30, label: "30 gün", phrase: "Son 30 günde" },
  { days: 90, label: "3 ay", phrase: "Son 3 ayda" },
] as const

const config = {
  analyses: { label: "Analiz", color: "var(--chart-1)" },
  score: { label: "Ortalama skor", color: "var(--chart-3)" },
} satisfies ChartConfig

const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" })

/** Zaman içinde analizler ve ortalama skor (DOG-145, dashboard-01 grafiği). */
export function ActivityChart({ timeline }: { timeline: TimelinePoint[] }) {
  const [days, setDays] = useState<number>(30)
  const data = bucketTimeline(timeline.slice(-days), days > 30 ? 7 : 1)
  const total = data.reduce((n, p) => n + p.analyses, 0)
  const range = RANGES.find((r) => r.days === days)!

  return (
    <Card className="gap-4 py-5 shadow-xs">
      <CardHeader className="px-5">
        <CardTitle>Analizlerin</CardTitle>
        <CardDescription>
          {range.phrase} {total} analiz
          {days > 30 && " · haftalık"}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(days)}
            onValueChange={(v) => v && setDays(Number(v))}
            aria-label="Zaman aralığı"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.days} value={String(r.days)} className="px-2.5">
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-5">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <ComposedChart data={data} margin={{ left: 16, right: 16, top: 8 }}>
            <defs>
              <linearGradient id="fillAnalyses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-analyses)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-analyses)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              tickFormatter={(d: string) => DAY_LABEL.format(new Date(d))}
            />
            <YAxis yAxisId="count" hide allowDecimals={false} domain={[0, (max: number) => Math.max(2, max)]} />
            <YAxis yAxisId="score" hide domain={[0, 100]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(d) => (days > 30 ? `${DAY_LABEL.format(new Date(String(d)))} haftası` : DAY_LABEL.format(new Date(String(d))))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              yAxisId="count"
              dataKey="analyses"
              type="monotone"
              fill="url(#fillAnalyses)"
              stroke="var(--color-analyses)"
              strokeWidth={2}
            />
            <Line
              yAxisId="score"
              dataKey="score"
              type="monotone"
              connectNulls
              stroke="var(--color-score)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-score)" }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
