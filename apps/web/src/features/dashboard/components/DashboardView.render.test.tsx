import { renderToStaticMarkup as renderBare } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { DashboardView } from "@/features/dashboard/components/DashboardView"
import type { DashboardSummary } from "@/features/dashboard/summary"

// "İlan bul" kartı profili kaydedebiliyor (DOG-68); sorgu istemcisi gerekiyor.
const renderToStaticMarkup = (el: ReactElement) => renderBare(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>)

const summary: DashboardSummary = {
  total: 4,
  stageCounts: { saved: 4, applied: 0, interview: 0, offer: 0, rejected: 0 },
  pending: [],
  recentAnalyses: [],
  metrics: { analysesLast30: 2, applied: 0, positive: 0, averageScore: 28 },
  timeline: [],
  outcomeSignal: null,
}

describe("DashboardView · beceri açığı (DOG-119)", () => {
  it("lists frequent gaps with posting and required counts", () => {
    const html = renderToStaticMarkup(
      <DashboardView name="Elif" targetRole={null} summary={summary} gaps={{ list: [{ term: "Docker", postings: 3, must: 2 }], analyses: 4 }} />,
    )
    expect(html).toContain("Sık eksik kalan kavramlar")
    expect(html).toContain("Son 4 analizinde")
    expect(html).toContain("3 ilanda · 2 zorunlu")
  })

  it("hides the box when there is nothing to show", () => {
    expect(renderToStaticMarkup(<DashboardView name="Elif" targetRole={null} summary={summary} />)).not.toContain(
      "Sık eksik kalan kavramlar",
    )
  })
})

describe("DashboardView · DOG-145", () => {
  it("shows the summary cards with a one-line meaning", () => {
    const html = renderToStaticMarkup(<DashboardView name="Elif" targetRole={null} summary={summary} />)
    expect(html).toContain("Ortalama skor")
    expect(html).toContain("Son 30 günde 2 yeni analiz")
    expect(html).toContain("Orta uyum bandında")
  })

  it("lists an upcoming interview with its day and links to the prep", () => {
    const html = renderToStaticMarkup(
      <DashboardView
        name="Elif"
        targetRole={null}
        summary={{
          ...summary,
          pending: [{ kind: "interview", analysisId: "a1", position: "Muhasebe Uzmanı", address: "/applications/a1/interview", date: "2026-10-22" }],
        }}
      />,
    )
    expect(html).toContain("Mülakatın 22 Ekim Perşembe")
    expect(html).toContain('href="/applications/a1/interview"')
  })

  it("shows the personal outcome signal only when there is one", () => {
    const html = renderToStaticMarkup(
      <DashboardView name="Elif" targetRole={null} summary={{ ...summary, outcomeSignal: ["Yüksek uyumlu 3 sonuçlanmış başvurunun 2 tanesi mülakata döndü."] }} />,
    )
    expect(html).toContain("Senin sonuçların")
    expect(renderToStaticMarkup(<DashboardView name="Elif" targetRole={null} summary={summary} />)).not.toContain("Senin sonuçların")
  })

  it("an empty dashboard is a single first-analysis card", () => {
    const html = renderToStaticMarkup(<DashboardView name="Elif" targetRole={null} summary={{ ...summary, total: 0 }} />)
    expect(html).toContain("İlk analizini yap")
    expect(html).toContain('href="/analyze#ornek-ilanlar"')
    expect(html).not.toContain("Ortalama skor")
  })
})

describe("DashboardView · önerilen arama (DOG-68)", () => {
  it("shows the profile's query and sends the search to /jobs", () => {
    const html = renderToStaticMarkup(<DashboardView name="Elif" targetRole={null} summary={summary} searchKeywords="Muhasebe Uzmanı" />)
    expect(html).toContain("Muhasebe Uzmanı")
    expect(html).toContain('href="/jobs"')
    expect(html).not.toContain("kariyer.net")
  })
})
