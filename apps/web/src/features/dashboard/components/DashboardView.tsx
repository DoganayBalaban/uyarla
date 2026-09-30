import Link from "next/link"
import { ArrowRight, CircleCheck, FilePen, Inbox, ListChecks, Plus } from "lucide-react"
import { resultPath } from "@/features/analysis/activeAnalysis"
import { cn } from "@/lib/cn"
import type { DashboardSummary, PendingItem, PendingKind } from "@/features/dashboard/summary"
import { STAGES, STAGE_LABEL, STAGE_COLOR, type Stage } from "@/features/applications/board"
import { scoreStatus } from "@/lib/scoreStatus"
import { PageHeader, PageShell } from "@/components/layout/PageShell"

/**
 * Kayıtlı kullanıcının ana ekranı. Tanıtım sayfası kayıtlı kullanıcıyı buraya
 * yönlendiriyor; logo da buraya götürüyor.
 *
 * Soru şu: "Şimdi ne yapmalıyım?" Önce seni bekleyen işler, sonra son
 * analizlerin, yanda başvuruların nerede durduğu. Sayılar yalnızca
 * kullanıcının kendi verisinden (rehber §11).
 */
export function DashboardView({ name, summary: summaryData }: { name: string | null; summary: DashboardSummary }) {
  // Ad yoksa ya da e-postanın kendisiyse selamda kullanılmıyor.
  const userName = name?.trim()
  const greeting = userName && !userName.includes("@") ? `Merhaba, ${userName.split(" ")[0]}.` : "Merhaba."

  const newAnalysisButton = (
    <Link
      href="/analyze"
      className="inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white no-underline shadow-sm shadow-mavi/30 transition hover:bg-mavi/90"
    >
      <Plus className="size-4" aria-hidden />
      Yeni analiz
    </Link>
  )

  if (summaryData.total === 0) {
    return (
      <PageShell width="wide">
        <PageHeader title={greeting} description="Burası senin ana ekranın. İlk analizinden sonra dolmaya başlar." />
        <div className="rounded-kart border border-dashed border-cizgi bg-kart p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
            <Inbox className="size-6" aria-hidden />
          </span>
          <p className="m-0 mt-4 font-baslik text-xl font-extrabold">Henüz analiz yok.</p>
          <p className="mt-2 text-gri">İlk ilanını yapıştır, birlikte başlayalım.</p>
          <Link
            href="/analyze"
            className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
          >
            İlk analizini yap
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title={greeting}
        description={
          summaryData.pending.length > 0 ? "Kaldığın yerden devam et." : "Bekleyen bir işin yok. Yeni bir ilana bakalım mı?"
        }
        action={newAnalysisButton}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {summaryData.pending.length > 0 && <PendingList list={summaryData.pending} />}
          <RecentAnalyses cards={summaryData.recentAnalyses} totalCount={summaryData.total} />
        </div>
        <ApplicationStages counts={summaryData.stageCounts} totalCount={summaryData.total} />
      </div>
    </PageShell>
  )
}

const PENDING_COPY: Record<PendingKind, { text: string; action: string; Icon: typeof ListChecks }> = {
  decide: { text: "Kararını bekleyen maddeler var", action: "Karar ver", Icon: ListChecks },
  ready: { text: "CV'n hazır, henüz başvurmadın", action: "CV'ni gör", Icon: CircleCheck },
  adapt: { text: "Skorunu aldın, CV'ni uyarlamadın", action: "Uyarla", Icon: FilePen },
}

function PendingList({ list }: { list: PendingItem[] }) {
  return (
    <section aria-labelledby="bekleyenler" className="rounded-kart border border-cizgi bg-kart">
      <h2 id="bekleyenler" className="m-0 px-5 pt-4 pb-3 text-base font-bold">
        Seni bekleyenler
      </h2>
      <ul className="m-0 list-none divide-y divide-cizgi border-t border-cizgi p-0">
        {list.map((b) => {
          const { text, action: actionButton, Icon } = PENDING_COPY[b.kind]
          return (
            <li key={b.analysisId}>
              <Link
                href={b.address}
                className="group flex items-center gap-4 px-5 py-3.5 text-metin no-underline transition-colors hover:bg-zemin"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-buton",
                    b.kind === "decide" ? "bg-kehribar/15 text-kehribar" : "bg-mavi/10 text-mavi",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.position}</span>
                  <span className="block text-sm text-gri">{text}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-mavi sm:inline-flex">
                  {actionButton}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

function RecentAnalyses({ cards, totalCount }: { cards: DashboardSummary["recentAnalyses"]; totalCount: number }) {
  return (
    <section aria-labelledby="son-analizler" className="rounded-kart border border-cizgi bg-kart">
      <div className="flex items-baseline justify-between gap-4 px-5 pt-4 pb-3">
        <h2 id="son-analizler" className="m-0 text-base font-bold">
          Son analizler
        </h2>
        {totalCount > cards.length && (
          <Link href="/applications" className="text-sm font-semibold text-mavi no-underline hover:underline">
            Tümü ({totalCount})
          </Link>
        )}
      </div>
      <ul className="m-0 list-none divide-y divide-cizgi border-t border-cizgi p-0">
        {cards.map((k) => {
          const state = k.score === null ? null : scoreStatus(k.score)
          return (
            <li key={k.analysisId}>
              <Link
                href={resultPath(k.analysisId)}
                className="flex items-center gap-4 px-5 py-3.5 text-metin no-underline transition-colors hover:bg-zemin"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{k.position}</span>
                  <span className="block text-sm text-gri">
                    {DATE_FORMAT.format(new Date(k.createdAt))} · {STAGE_LABEL[k.stage]}
                  </span>
                </span>
                {state && k.score !== null && (
                  <span
                    className={cn("shrink-0 rounded-buton px-2.5 py-1 text-right", state.bgClass)}
                    title={state.label}
                  >
                    <span className={cn("block font-baslik text-lg leading-none font-extrabold tabular-nums", state.textClass)}>
                      {k.score}
                    </span>
                    <span className={cn("block text-[0.6875rem] font-semibold", state.textClass)}>{state.label}</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ApplicationStages({ counts, totalCount }: { counts: Record<Stage, number>; totalCount: number }) {
  return (
    <section aria-labelledby="basvurular" className="rounded-kart border border-cizgi bg-kart p-5">
      <h2 id="basvurular" className="m-0 text-base font-bold">
        Başvuruların
      </h2>
      <p className="m-0 mt-1 text-sm text-gri">{totalCount} ilan, aşamalarına göre.</p>

      {/* Dağılım çubuğu: her aşama payı kadar. Sayılar aşağıdaki listede
          yazılı; çubuk yalnızca göz için, ekran okuyucudan gizli. */}
      <div aria-hidden className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-zemin">
        {STAGES.filter((a) => counts[a] > 0).map((a) => (
          <span key={a} className={STAGE_COLOR[a]} style={{ flexGrow: counts[a] }} />
        ))}
      </div>

      <dl className="m-0 mt-4 space-y-2">
        {STAGES.map((a) => (
          <div key={a} className="flex items-center gap-2.5 text-sm">
            <span aria-hidden className={cn("size-2.5 rounded-full", STAGE_COLOR[a])} />
            <dt className="flex-1 text-gri">{STAGE_LABEL[a]}</dt>
            <dd className="m-0 font-semibold tabular-nums">{counts[a]}</dd>
          </div>
        ))}
      </dl>

      <Link
        href="/applications"
        className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-mavi no-underline hover:underline"
      >
        Panoya git
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}
