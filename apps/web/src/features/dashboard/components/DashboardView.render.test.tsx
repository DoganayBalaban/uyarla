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

describe("DashboardView · İlan bul (DOG-68)", () => {
  it("links to the job sites with the profile's query", () => {
    const html = renderToStaticMarkup(<DashboardView name="Elif" targetRole={null} summary={summary} searchKeywords="Muhasebe Uzmanı" />)
    expect(html).toContain("İlan bul")
    expect(html).toContain("https://www.kariyer.net/is-ilanlari?kw=Muhasebe%20Uzman%C4%B1")
    expect(html).toContain('target="_blank"')
  })
})
