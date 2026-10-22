import Link from "next/link"
import { ArrowRight, CalendarClock, CircleCheck, FilePen, FileSearch, Hourglass, ListChecks, Plus, Search, Sparkles } from "lucide-react"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/cn"
import type { DashboardSummary, PendingItem, PendingKind } from "@/features/dashboard/summary"
import type { SkillGap } from "@/features/dashboard/skillGaps"
import { ActivityChart } from "@/features/dashboard/components/ActivityChart"
import { RecentAnalysesTable } from "@/features/dashboard/components/RecentAnalysesTable"
import { SectionCards } from "@/features/dashboard/components/SectionCards"

/**
 * Kayıtlı kullanıcının ana ekranı (DOG-145, dashboard-01 düzeni). Tanıtım
 * sayfası kayıtlı kullanıcıyı buraya yönlendiriyor; logo da buraya götürüyor.
 *
 * Üstte özet kartları, ortada zaman içindeki analizler, altta seni bekleyen
 * işler ve son analizler; yanda kendi sonuçların, sık eksik kavramlar ve
 * önerilen arama. Sayılar yalnızca kullanıcının kendi verisinden (rehber §11).
 */
export function DashboardView({
  name,
  targetRole,
  summary: summaryData,
  gaps = { list: [], analyses: 0 },
  searchKeywords = "",
}: {
  name: string | null
  targetRole: string | null
  summary: DashboardSummary
  /** Beceri açığı raporu (DOG-119). */
  gaps?: { list: SkillGap[]; analyses: number }
  /** Önerilen arama (DOG-68); arama kartı /jobs'ta. */
  searchKeywords?: string
}) {
  // Ad yoksa ya da e-postanın kendisiyse selamda kullanılmıyor.
  const userName = name?.trim()
  const greeting = userName && !userName.includes("@") ? `Merhaba, ${userName.split(" ")[0]}.` : "Merhaba."
  // Onboarding'de verilen hedef rol (DOG-50).
  const describe = (text: string) => (targetRole ? `${text} Hedefin: ${targetRole}.` : text)

  if (summaryData.total === 0) {
    return (
      <AppPage title={greeting} description={describe("Burası senin ana ekranın. İlk analizinden sonra dolmaya başlar.")}>
        <Card className="items-center border-dashed py-12 text-center shadow-none">
          <CardContent className="flex flex-col items-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <FileSearch className="size-6" aria-hidden />
            </span>
            <p className="m-0 mt-4 text-lg font-semibold">İlk analizini yap</p>
            <p className="m-0 mt-1 max-w-sm text-sm text-muted-foreground">
              CV&apos;ni yükle, ilanı yapıştır; uyumunu ve eksiklerini hemen gör. Elinde ilan yoksa örnek bir ilanla dene.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/analyze">
                  <Plus aria-hidden /> İlk analizini yap
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/analyze#ornek-ilanlar">Örnek ilanla dene</Link>
              </Button>
            </div>
            {/* Hazır olmayan ilk ziyaret için iki kısa yol (DOG-101). */}
            <p className="m-0 mt-5 text-sm text-muted-foreground">
              <Link href="/sample-report" className="font-medium text-foreground underline underline-offset-2">
                Örnek raporu gör
              </Link>
              {" · "}
              <Link href="/get-started" className="font-medium text-foreground underline underline-offset-2">
                Nereden başlamalıyım?
              </Link>
            </p>
          </CardContent>
        </Card>
      </AppPage>
    )
  }

  return (
    <AppPage
      title={greeting}
      description={describe(summaryData.pending.length > 0 ? "Kaldığın yerden devam et." : "Bekleyen bir işin yok. Yeni bir ilana bakalım mı?")}
      actions={
        <Button asChild>
          <Link href="/analyze">
            <Plus aria-hidden /> Yeni analiz
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <SectionCards total={summaryData.total} metrics={summaryData.metrics} />
        <ActivityChart timeline={summaryData.timeline} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            {summaryData.pending.length > 0 && <PendingList list={summaryData.pending} />}
            <RecentAnalysesTable cards={summaryData.recentAnalyses} totalCount={summaryData.total} />
          </div>
          <div className="space-y-6">
            {summaryData.outcomeSignal && <OutcomeSignal lines={summaryData.outcomeSignal} />}
            {gaps.list.length > 0 && <SkillGaps list={gaps.list} analyses={gaps.analyses} />}
            <SuggestedSearch keywords={searchKeywords} />
          </div>
        </div>
      </div>
    </AppPage>
  )
}

const DAY_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" })
const day = (date: string) => DAY_FORMAT.format(new Date(`${date}T00:00:00Z`))

const PENDING_COPY: Record<PendingKind, { text: (b: PendingItem) => string; action: string; Icon: typeof ListChecks; tone: string }> = {
  interview: { text: (b) => `Mülakatın ${day(b.date!)}`, action: "Hazırlan", Icon: CalendarClock, tone: "bg-brand-amber/15 text-brand-amber" },
  decide: { text: () => "Kararını bekleyen maddeler var", action: "Karar ver", Icon: ListChecks, tone: "bg-brand-amber/15 text-brand-amber" },
  deadline: { text: (b) => `Son başvuru ${day(b.date!)}`, action: "Başvuruyu aç", Icon: Hourglass, tone: "bg-brand-red/10 text-brand-red" },
  ready: { text: () => "CV'n hazır, henüz başvurmadın", action: "CV'ni gör", Icon: CircleCheck, tone: "bg-primary/10 text-primary" },
  adapt: { text: () => "Skorunu aldın, CV'ni uyarlamadın", action: "Uyarla", Icon: FilePen, tone: "bg-primary/10 text-primary" },
}

function PendingList({ list }: { list: PendingItem[] }) {
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle>Seni bekleyenler</CardTitle>
      </CardHeader>
      <ul className="m-0 list-none divide-y border-t p-0">
        {list.map((b) => {
          const { text, action, Icon, tone } = PENDING_COPY[b.kind]
          return (
            <li key={`${b.kind}-${b.analysisId}`}>
              <Link
                href={b.address}
                className="group flex items-center gap-4 px-5 py-3.5 text-foreground no-underline transition-colors hover:bg-muted/50"
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.position}</span>
                  <span className="block text-sm text-muted-foreground">{text(b)}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary sm:inline-flex">
                  {action}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Kendi sonuçların (DOG-124): skor bandına göre mülakata dönen başvurular. */
function OutcomeSignal({ lines }: { lines: string[] }) {
  return (
    <Card className="gap-3 py-5 shadow-xs">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          Senin sonuçların
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-5 text-sm">
        {lines.map((line) => (
          <p key={line} className="m-0">
            {line}
          </p>
        ))}
        <p className="m-0 pt-1 text-xs text-muted-foreground">Yalnızca kendi başvuruların; az sayıda başvuruda tesadüf payı büyük.</p>
      </CardContent>
    </Card>
  )
}

/** "İş ara" kendi sayfasında (/jobs); burada yalnızca profilden kurulan sorgu. */
function SuggestedSearch({ keywords }: { keywords: string }) {
  return (
    <Card className="gap-3 py-5 shadow-xs">
      <CardHeader className="px-5">
        <CardTitle>Önerilen arama</CardTitle>
        <CardDescription>
          {keywords ? "Profilinden ve hedef rolünden kuruldu." : "Hedef rolünü yaz, iş sitelerinde birlikte arayalım."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {keywords && (
          <Badge variant="secondary" className="max-w-full truncate">
            {keywords}
          </Badge>
        )}
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href="/jobs">
            <Search aria-hidden /> İş ara
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Sık eksik kalan kavramlar (DOG-119). Yalnızca kullanıcının kendi
 * analizlerinden; öğrenme kaynağı önermiyoruz, ne yapacağını söylüyoruz.
 */
function SkillGaps({ list, analyses }: { list: SkillGap[]; analyses: number }) {
  return (
    <Card className="gap-3 py-5 shadow-xs">
      <CardHeader className="px-5">
        <CardTitle>Sık eksik kalan kavramlar</CardTitle>
        <CardDescription>
          Son {analyses} analizinde CV&apos;nde karşılığı bulunmayanlar. Deneyiminde varsa CV&apos;nde görünür kıl; yoksa
          öğrenme listene ekleyebilirsin.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <ul className="m-0 list-none space-y-3 p-0">
          {list.map((g) => (
            <li key={g.term} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{g.term}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {g.postings} ilanda{g.must > 0 ? ` · ${g.must} zorunlu` : ""}
                </span>
              </div>
              {/* Payı gösteren çubuk; sayı yanında yazılı, ekran okuyucudan gizli. */}
              <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", g.must > 0 ? "bg-brand-amber" : "bg-primary/60")}
                  style={{ width: `${Math.min(100, Math.round((g.postings / Math.max(1, analyses)) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
