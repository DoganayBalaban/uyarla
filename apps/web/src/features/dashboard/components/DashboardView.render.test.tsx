import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DashboardView } from "@/features/dashboard/components/DashboardView"
import type { DashboardSummary } from "@/features/dashboard/summary"

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
