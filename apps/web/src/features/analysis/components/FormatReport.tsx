"use client"

import Link from "next/link"
import { ChevronDown, CircleCheck, OctagonAlert, ScanText, TriangleAlert, Wand2 } from "lucide-react"
import type { FormatFinding, FormatReport } from "@uyarla/core/format/check"
import { cn } from "@/lib/cn"
import { fixHint } from "@/features/analysis/formatFixes"
import { ImpactBadge } from "@/features/analysis/components/ImpactBadge"
import { TITLE_FINDING_CODES, type ScoreImpact } from "@/features/analysis/scoreImpact"

// Tipler core'dan: web kendi kopyasını tutarsa bir anahtar değiştiğinde
// TypeScript uyarmıyor ve ekran sessizce boş kalıyor (DOG-39).
export type FormatReportView = Pick<FormatReport, "findings" | "passed">

/**
 * CV kontrolü. Skordan ayrı bir soru: skor "ilana uyuyor mu", bu bölüm "ATS
 * doğru okuyabilir mi" ve "işe alımcı okuyunca ne görüyor" (içerik bulguları,
 * DOG-86; ilandan bağımsızlar). Durum renkleri yalnızca durumu
 * anlatıyor ve her zaman bir etiketle birlikte (rehber §9.2).
 *
 * Bulgular 21st.dev'deki "alert" bileşenlerinin desenini izliyor: ikon,
 * başlık, açıklama; seviye sol kenar rengi ve etiketle birlikte.
 */
export function FormatReportCard({
  report,
  impact,
  titleImpact,
  titleAction,
}: {
  report: FormatReportView
  /** Skor etkisi rozetleri (DOG-132); yalnızca analiz sonucunda. */
  impact?: ScoreImpact
  titleImpact?: ScoreImpact | null
  /** Unvan bulgusunun altındaki düzeltme (DOG-134). */
  titleAction?: React.ReactNode
}) {
  const problemCount = report.findings.filter((b) => b.severity === "problem").length
  // Eski kayıtlarda grup yok: hepsi okunabilirlik bulgusu (DOG-86).
  const readability = report.findings.filter((b) => b.group !== "content")
  const content = report.findings.filter((b) => b.group === "content")
  const warningCount = report.findings.length - problemCount

  return (
    <section className="rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-button bg-brand-blue/10 text-brand-blue">
            <ScanText className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="m-0 text-lg">
              CV kontrolü {impact && <ImpactBadge impact={impact} className="ml-1" />}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">Başvuru sistemleri CV&apos;ni doğru okuyabilir mi, işe alımcı ne görüyor?</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
          {problemCount > 0 && (
            <li className="rounded-full bg-brand-red/10 px-2.5 py-1 text-brand-red dark:text-[#f87171]">{problemCount} sorun</li>
          )}
          {warningCount > 0 && <li className="rounded-full bg-brand-amber/15 px-2.5 py-1 text-brand-amber">{warningCount} uyarı</li>}
          <li className="rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green dark:text-[#4ade80]">
            {report.passed.length} kontrol geçti
          </li>
        </ul>
      </div>

      {report.findings.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-brand-green dark:text-[#4ade80]" aria-hidden />
          CV&apos;nde ATS&apos;in okumasını zorlaştıracak ya da işe alımcının gözüne batacak bir sorun bulmadık.
        </p>
      ) : (
        <>
          {readability.length > 0 && (
            <ul className="mt-5 space-y-2.5">
              {readability.map((b) => (
                <FindingItem
                  key={b.code}
                  finding={b}
                  impact={TITLE_FINDING_CODES.includes(b.code) ? titleImpact : null}
                  action={TITLE_FINDING_CODES.includes(b.code) ? titleAction : null}
                />
              ))}
            </ul>
          )}
          {content.length > 0 && (
            <div className="mt-5">
              <h3 className="m-0 text-sm font-semibold text-muted-foreground">İşe alımcı gözüyle</h3>
              <ul className="mt-2.5 space-y-2.5">
                {content.map((b) => (
                  <FindingItem
                  key={b.code}
                  finding={b}
                  impact={TITLE_FINDING_CODES.includes(b.code) ? titleImpact : null}
                  action={TITLE_FINDING_CODES.includes(b.code) ? titleAction : null}
                />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {report.passed.length > 0 && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground">
            Geçen kontroller
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {report.passed.map((g) => (
              <li key={g} className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <CircleCheck className="size-3.5 text-brand-green dark:text-[#4ade80]" aria-hidden />
                {g}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function FindingItem({
  finding: b,
  impact,
  action,
}: {
  finding: FormatFinding
  impact?: ScoreImpact | null
  action?: React.ReactNode
}) {
  const isProblem = b.severity === "problem"
  const Icon = isProblem ? OctagonAlert : TriangleAlert
  const hint = fixHint(b.code)
  return (
    <li
      className={cn(
        "flex gap-3 rounded-button border border-border border-l-4 bg-background/60 p-3.5",
        isProblem ? "border-l-brand-red" : "border-l-brand-amber",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", isProblem ? "text-brand-red dark:text-[#f87171]" : "text-brand-amber")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="m-0 font-semibold">
          <span className="sr-only">{isProblem ? "Sorun: " : "Uyarı: "}</span>
          {b.title}
          {impact && <ImpactBadge impact={impact} className="ml-2" />}
        </p>
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">{b.description}</p>
        {b.examples && b.examples.length > 0 && (
          <div className="mt-2">
            <p className="m-0 text-xs font-medium">Rakam ekleyebileceğin cümleler:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
              {b.examples.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {hint && (
          <p
            className={cn(
              "m-0 mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium",
              hint.kind === "action" ? "text-foreground" : "text-brand-green dark:text-[#4ade80]",
            )}
          >
            <Wand2 className="size-3.5" aria-hidden />
            {hint.href ? (
              <Link href={hint.href} className="underline underline-offset-2">
                {hint.text}
              </Link>
            ) : (
              hint.text
            )}
          </p>
        )}
        {action}
      </div>
      <span
        aria-hidden
        className={cn(
          "ml-auto h-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
          isProblem ? "bg-brand-red/10 text-brand-red dark:text-[#f87171]" : "bg-brand-amber/15 text-brand-amber",
        )}
      >
        {isProblem ? "Sorun" : "Uyarı"}
      </span>
    </li>
  )
}
