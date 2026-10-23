"use client"

import { CircleAlert, CircleCheck, Info, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AuditCheck, AuditSectionId, AuditSectionStatus } from "@uyarla/core/linkedin/audit"
import { HEADLINE_MAX_CHARS } from "@uyarla/core/linkedin/reportRecord"
import type { AuditResponse, AuditView } from "@/features/linkedin/audit"
import { SECTION_LABELS, STATUS_LABELS, initials, sectionDelta } from "@/features/linkedin/sections"
import { CopyButton, LockedRewrite, RewriteBlock } from "@/features/linkedin/components/RewriteBlock"
import { cn } from "@/lib/cn"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

const STATUS_STYLE: Record<AuditSectionStatus, string> = {
  strong: "bg-brand-green/10 text-brand-green dark:text-[#4ade80]",
  improve: "bg-brand-amber/15 text-brand-amber",
  missing: "bg-destructive/10 text-destructive",
  info: "bg-muted text-muted-foreground",
}
const DOT: Record<AuditSectionStatus, string> = { strong: "bg-brand-green", improve: "bg-brand-amber", missing: "bg-destructive", info: "bg-muted-foreground/40" }

function CheckRow({ check }: { check: AuditCheck }) {
  const Icon = check.status === "ok" ? CircleCheck : check.status === "missing" ? CircleAlert : TriangleAlert
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={cn("mt-0.5 size-4 shrink-0", check.status === "ok" ? "text-brand-green" : check.status === "missing" ? "text-destructive" : "text-brand-amber")} aria-hidden />
      <span className={check.status === "ok" ? "text-muted-foreground" : undefined}>{check.text}</span>
    </li>
  )
}

function SectionCard({ id, status, checks, children }: { id: AuditSectionId; status: AuditSectionStatus; checks: AuditCheck[]; children?: React.ReactNode }) {
  return (
    <Card id={`bolum-${id}`} className="scroll-mt-20 gap-4 py-5 shadow-xs">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{SECTION_LABELS[id]}</CardTitle>
        <CardAction>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>{STATUS_LABELS[status]}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {checks.length > 0 && (
          <ul className="list-none space-y-2 p-0">
            {checks.map((c, i) => (
              <CheckRow key={`${c.id}-${c.role ?? i}`} check={c} />
            ))}
          </ul>
        )}
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * LinkedIn denetiminin sonucu (DOG-157, spec §5.1c): profil kartı, bölüm
 * menüsü ve bölüm kartları. Kilitli yazımın metni sunucudan gelmiyor; yerine
 * bulanık iskelet ve paket bağlantısı.
 */
export function AuditResult({
  audit,
  previous,
  onRescan,
  onRetry,
}: {
  audit: AuditView
  previous: AuditResponse["previous"]
  /** Kilit sunucuda çözülüyor (yanıtta "locked"); burada yalnızca bilgi. */
  unlocked: boolean
  onRescan: () => void
  onRetry: () => void
}) {
  const report = audit.report!
  const profile = audit.profile!
  const rewrites = audit.rewrites
  const delta = sectionDelta(previous, report)
  const sectionOf = (id: AuditSectionId) => report.sections.find((s) => s.id === id)
  const truncatedExperience = profile.truncated.experience
  // Sayfa ya da PDF becerilerin yalnızca ilklerini gösteriyor: "öne al" zaten öndekileri söylerdi.
  const partialSkills = !!profile.truncated.skills
  const experience = sectionOf("experience")

  return (
    <div className="space-y-6">
      {/* Profil kartı: LinkedIn başlığına benzer; fotoğraf yok, baş harfler. */}
      <Card className="overflow-hidden py-0 shadow-xs">
        <div aria-hidden className="h-16 bg-gradient-to-r from-primary/70 via-primary/40 to-brand-coral/40" />
        <CardContent className="flex flex-wrap items-end justify-between gap-4 px-5 pb-5">
          <div className="-mt-8 flex min-w-0 items-end gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-card bg-primary text-xl font-semibold text-primary-foreground">
              {initials(profile.name)}
            </span>
            <div className="min-w-0 pb-1">
              <p className="m-0 truncate text-lg font-semibold">{profile.name ?? "LinkedIn profilin"}</p>
              <p className="m-0 truncate text-sm text-muted-foreground">{profile.headline ?? "Başlık yok"}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="m-0 text-2xl font-semibold tabular-nums">
              {report.summary.total} kontrolden {report.summary.passed}&apos;i geçti
            </p>
            {delta && (delta.passedDelta !== 0 || delta.improved.length > 0) && (
              <p className="m-0 text-xs text-muted-foreground">
                {[
                  delta.passedDelta !== 0 && `Önceki taramaya göre ${delta.passedDelta > 0 ? `+${delta.passedDelta}` : delta.passedDelta} kontrol`,
                  delta.improved.length > 0 && `İyileşen: ${delta.improved.map((id) => SECTION_LABELS[id]).join(", ")}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {report.sections.map((s) => (
              <a key={s.id} href={`#bolum-${s.id}`} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLE[s.status])}>
                {SECTION_LABELS[s.id]}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Son tarama {DATE.format(new Date(audit.createdAt))}</span>
            <Button type="button" size="sm" variant="outline" onClick={onRescan}>
              <RefreshCw aria-hidden /> Yeniden tara
            </Button>
          </div>
        </div>
      </Card>

      {truncatedExperience && (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Deneyimlerinden {truncatedExperience.shown}&apos;i okundu
          {truncatedExperience.total ? ` (toplam ${truncatedExperience.total})` : ""}; tamamı için PDF de yükleyebilirsin.
        </p>
      )}
      {report.skipped.includes("headline_target") && <p className="text-sm text-muted-foreground">Hedef rolünü yazarsan başlığına ona göre de bakarız.</p>}
      {audit.canRetry && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Bazı önerileri şu an yazamadık.
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw aria-hidden /> Tekrar dene
          </Button>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Bölümler" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 lg:flex-col">
            {report.sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#bolum-${s.id}`} className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-muted">
                  <span aria-hidden className={cn("size-2 rounded-full", DOT[s.status])} />
                  {SECTION_LABELS[s.id]}
                  <span className="sr-only">: {STATUS_LABELS[s.status]}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          {sectionOf("headline") && (
            <SectionCard {...sectionOf("headline")!}>
              {rewrites?.headline.status === "done" && rewrites.headline.options.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-primary">Başlık önerilerimiz</p>
                  <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                    {rewrites.headline.options.map((o) => (
                      <li key={o.text} className="flex flex-col justify-between gap-2 rounded-lg border p-3">
                        <p className="m-0 text-sm">{o.text}</p>
                        {o.verification.status === "flagged" && (
                          <p className="m-0 flex items-start gap-1.5 text-xs text-brand-amber">
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            {o.verification.issues.map((i) => i.detail).join(" ")}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {o.text.length} / {HEADLINE_MAX_CHARS}
                          </span>
                          <CopyButton text={o.text} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}

          {sectionOf("about") && (
            <SectionCard {...sectionOf("about")!}>
              {rewrites?.about.status === "locked" && <LockedRewrite />}
              {rewrites?.about.status === "done" && <RewriteBlock current={profile.about} suggestion={rewrites.about.suggestion} />}
            </SectionCard>
          )}

          {experience && (
            <SectionCard id="experience" status={experience.status} checks={experience.checks.filter((c) => c.role === undefined)}>
              <div className="space-y-2">
                {profile.experience.map((role, index) => {
                  const own = experience.checks.filter((c) => c.role === index)
                  const rewrite = rewrites?.experience.find((e) => e.index === index)
                  return (
                    <details key={`${role.title}-${index}`} className="group rounded-lg border" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{role.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[role.company, role.dateRange].filter(Boolean).join(" · ")}</span>
                        </span>
                        {own.some((c) => c.status !== "ok") && <Badge variant="secondary">Öneri var</Badge>}
                      </summary>
                      <div className="space-y-3 border-t p-3">
                        {own.length > 0 && (
                          <ul className="list-none space-y-2 p-0">
                            {own.map((c, i) => (
                              <CheckRow key={`${c.id}-${i}`} check={c} />
                            ))}
                          </ul>
                        )}
                        {rewrite?.status === "locked" && <LockedRewrite />}
                        {rewrite?.status === "done" && <RewriteBlock current={role.description} suggestion={rewrite.suggestion} />}
                        {rewrite?.status === "template" && (
                          <div className="rounded-lg border border-dashed p-3">
                            <p className="m-0 text-xs font-semibold text-muted-foreground">Doldurman için şablon</p>
                            <p className="m-0 mt-1 text-sm whitespace-pre-line">{rewrite.text}</p>
                            <div className="mt-2">
                              <CopyButton text={rewrite.text} />
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {sectionOf("education") && <SectionCard {...sectionOf("education")!} />}

          {sectionOf("certifications") && (
            <SectionCard {...sectionOf("certifications")!}>
              {profile.certifications.length > 0 ? (
                <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
                  {profile.certifications.map((c) => (
                    <li key={c.name}>{[c.name, c.issuer, c.date].filter(Boolean).join(" · ")}</li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Sertifikan yok. Hedefindeki ilanlar bir sertifika istiyorsa onu almayı düşünebilirsin.</p>
              )}
            </SectionCard>
          )}

          {sectionOf("skills") && (
            <SectionCard {...sectionOf("skills")!}>
              {report.skills.add.length > 0 && (
                <div>
                  <p className="m-0 text-xs font-semibold text-primary">Ekle (deneyiminde geçiyor{partialSkills ? "; tam listende yoksa" : ""})</p>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                    {report.skills.add.map((a) => (
                      <li key={a.term} title={a.evidence} className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium">
                        + {a.term}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!partialSkills && report.skills.pinFirst.length > 0 && (
                <div>
                  <p className="m-0 text-xs font-semibold text-muted-foreground">Öne al</p>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                    {report.skills.pinFirst.map((s) => (
                      <li key={s} className="rounded-full border px-2.5 py-1 text-xs">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          )}

          {sectionOf("postings") && (
            <SectionCard {...sectionOf("postings")!}>
              {report.commonMissing.length > 0 ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {report.commonMissing.map((m) => (
                    <li key={m.term} className="rounded-full border border-dashed px-2.5 py-1 text-xs">
                      {m.term}
                      {m.must ? " · zorunlu" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Seçtiğin ilanların ortak bir eksiği yok.</p>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}
