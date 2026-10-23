"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { auditProfile } from "@uyarla/core/linkedin/audit"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { AuditView } from "@/features/linkedin/audit"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import { AuditStart } from "@/features/linkedin/components/AuditStart"

/** Kurgusal profil (eval cv-d-pazarlama); gerçek kişi değil. */
const PROFILE = {
  name: "Deniz Aksoy",
  headline: "Performance Marketing Specialist",
  about: "E-ticaret ve ajans tarafında dört yıllık performans pazarlaması deneyimim var.",
  experience: [
    { title: "Performance Marketing Specialist", company: "Moda Sepeti", dateRange: "Mar 2023 - Present", location: "İstanbul", description: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panoları hazırladım." },
    { title: "Digital Marketing Executive", company: "Parlak Dijital Ajans", dateRange: "Eyl 2021 - Şub 2023", location: null, description: null },
  ],
  education: [{ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "2017 - 2021", description: null }],
  certifications: [{ name: "Google Ads Search Certification", issuer: "Google", date: null }],
  skills: ["Google Ads", "Looker Studio"],
  languages: ["İngilizce"],
  truncated: { experience: { shown: 2, total: 4 } },
}
const ok = { status: "ok" as const, issues: [] }

/** LinkedIn denetiminin hâlleri (DOG-157); yalnızca yerelde. */
export function LinkedInShowcase() {
  const [view, setView] = useState<"start" | "locked" | "open">("locked")
  const [client] = useState(() => new QueryClient())
  const report = auditProfile(PROFILE, { targetRole: "Dijital Pazarlama Uzmanı", goal: null, scored: [] })
  const audit = (open: boolean): AuditView => ({
    id: "vitrin",
    status: "done",
    stage: null,
    source: "extension",
    createdAt: new Date().toISOString(),
    profile: PROFILE,
    targetRole: "Dijital Pazarlama Uzmanı",
    analysisIds: [],
    report,
    rewrites: {
      headline: {
        status: "done",
        options: ["Performance Marketing Specialist | Google Ads, GA4, Looker Studio", "Performans Pazarlama | Meta ve Google reklamları", "E-ticaret büyümesi | Google Ads, GA4"].map((text) => ({ text, verification: ok })),
      },
      about: open
        ? { status: "done", suggestion: { text: "Moda Sepeti'nde Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönetiyorum; GA4 panolarıyla haftalık rapor hazırlıyorum.", verification: ok } }
        : { status: "locked" },
      experience: [
        open
          ? { index: 0, status: "done", suggestion: { text: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panolarıyla haftalık performans raporu hazırladım.", verification: ok } }
          : { index: 0, status: "locked" },
        { index: 1, status: "template", text: "• [Ne yaptın] ile [ölçülebilir sonuç]" },
      ],
    },
    locked: open ? null : { about: true, experience: 1 },
    canRetry: false,
  })

  return (
    <QueryClientProvider client={client}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as typeof view)}>
          <ToggleGroupItem value="start">Başlangıç</ToggleGroupItem>
          <ToggleGroupItem value="locked">Sonuç · kilitli</ToggleGroupItem>
          <ToggleGroupItem value="open">Sonuç · açık</ToggleGroupItem>
        </ToggleGroup>
        {view === "start" && <AuditStart targetRole="Dijital Pazarlama Uzmanı" extension={{ installed: false }} busy={false} error={null} onStart={() => {}} onTargetRoleSave={async () => {}} />}
        {view !== "start" && <AuditResult audit={audit(view === "open")} previous={null} unlocked={view === "open"} onRescan={() => {}} onRetry={() => {}} />}
      </main>
    </QueryClientProvider>
  )
}
