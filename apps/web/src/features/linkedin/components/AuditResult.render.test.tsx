import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { auditProfile } from "@uyarla/core/linkedin/audit"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import type { AuditView } from "@/features/linkedin/audit"

const profile = {
  name: "Deniz Aksoy",
  headline: "Pazarlama",
  about: null,
  experience: [{ title: "Uzman", company: "Acme", dateRange: "2022 - Present", location: null, description: "• Meta kampanyalarını yönettim." }],
  education: [],
  certifications: [],
  skills: ["Google Ads"],
  languages: [],
  truncated: { experience: { shown: 5, total: 8 } },
}
const ok = { status: "ok" as const, issues: [] }
const audit = (over: Partial<AuditView> = {}): AuditView => ({
  id: "au1",
  status: "done",
  stage: null,
  source: "extension",
  createdAt: "2026-10-22T12:00:00.000Z",
  profile,
  targetRole: "Dijital Pazarlama Uzmanı",
  analysisIds: [],
  report: auditProfile(profile, { targetRole: "Dijital Pazarlama Uzmanı", goal: null, scored: [] }),
  rewrites: {
    headline: { status: "done", options: [{ text: "Uzman | Google Ads, Meta", verification: ok }] },
    about: { status: "locked" },
    experience: [{ index: 0, status: "locked" }],
  },
  locked: { about: true, experience: 1 },
  canRetry: false,
  ...over,
})
const render = (a: AuditView, unlocked = false) => renderToStaticMarkup(<AuditResult audit={a} previous={null} unlocked={unlocked} onRescan={() => {}} onRetry={() => {}} />)

describe("AuditResult", () => {
  it("shows the profile card, the honest summary and the truncation note", () => {
    const html = render(audit())
    expect(html).toContain("Deniz Aksoy")
    expect(html).toMatch(/\d+ kontrolden \d+&#x27;i geçti|\d+ kontrolden \d+'i geçti/)
    expect(html).toContain("Deneyimlerinden 5&#x27;i okundu")
    // Ekranda yüzde yok; iskelet satırlarının genişliği (style) metin değil.
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/%/)
  })

  it("free headline options are copyable; locked rewrites show only a skeleton and the plans link", () => {
    const html = render(audit())
    expect(html).toContain("Uzman | Google Ads, Meta")
    expect(html).toContain("Önerin hazır; paketle açılır")
    expect(html).toContain('href="/plans?donus=%2Flinkedin"')
  })

  it("shows unlocked rewrites with the before text", () => {
    const html = render(
      audit({
        rewrites: {
          headline: { status: "done", options: [] },
          about: { status: "done", suggestion: { text: "Meta kampanyalarını yönetiyorum.", verification: ok } },
          experience: [{ index: 0, status: "done", suggestion: { text: "• Meta kampanyalarını yönettim.", verification: { status: "flagged", issues: [{ kind: "number", detail: "Kontrol et" }] } } }],
        },
        locked: null,
      }),
      true,
    )
    expect(html).toContain("Meta kampanyalarını yönetiyorum.")
    expect(html).toContain("Kontrol et")
    expect(html).not.toContain("paketle açılır")
  })
})
