import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LockedFeatureCard, isLocked } from "@/features/billing/components/LockedFeature"
import type { BillingStatus } from "@/features/billing/api"

describe("LockedFeature (DOG-158)", () => {
  it("explains what it opens and links to the plans with a way back", () => {
    const html = renderToStaticMarkup(
      <LockedFeatureCard title="Mülakat hazırlık paketi" description="Olası sorular ve cevap iskeletleri." returnTo="/applications/a1/interview" trial />,
    )
    expect(html).toContain("Mülakat hazırlık paketi")
    expect(html).toContain("7 gün ücretsiz dene")
    expect(html).toContain('href="/plans?donus=%2Fapplications%2Fa1%2Finterview"')
    expect(renderToStaticMarkup(<LockedFeatureCard title="X" description="Y" returnTo="/" trial={false} />)).toContain("Abone ol")
  })

  it("is locked only for a free user, never while the status is loading", () => {
    expect(isLocked(undefined)).toBe(false)
    expect(isLocked({ access: false, unlimited: false } as BillingStatus)).toBe(true)
    expect(isLocked({ access: true, unlimited: false } as BillingStatus)).toBe(false)
  })
})
