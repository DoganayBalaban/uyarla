"use client"

import { ChevronDown, CircleCheck, OctagonAlert, ScanText, TriangleAlert } from "lucide-react"
import type { FormatReport } from "@uyarla/core"
import { cn } from "@/lib/cn"

// Tipler core'dan: web kendi kopyasını tutarsa bir anahtar değiştiğinde
// TypeScript uyarmıyor ve ekran sessizce boş kalıyor (DOG-39).
export type FormatReportView = Pick<FormatReport, "findings" | "passed">

/**
 * CV'nin ATS okunabilirliği. Skordan ayrı bir soru: skor "ilana uyuyor mu",
 * bu bölüm "ATS doğru okuyabilir mi". Durum renkleri yalnızca durumu
 * anlatıyor ve her zaman bir etiketle birlikte (rehber §9.2).
 *
 * Bulgular 21st.dev'deki "alert" bileşenlerinin desenini izliyor: ikon,
 * başlık, açıklama; seviye sol kenar rengi ve etiketle birlikte.
 */
export function FormatReportCard({ report }: { report: FormatReportView }) {
  const problemCount = report.findings.filter((b) => b.severity === "problem").length
  const warningCount = report.findings.length - problemCount

  return (
    <section className="rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-button bg-brand-blue/10 text-brand-blue">
            <ScanText className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="m-0 text-lg">ATS okunabilirliği</h2>
            <p className="m-0 text-sm text-muted">Başvuru sistemleri CV&apos;ni doğru okuyabilir mi?</p>
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
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CircleCheck className="size-4 text-brand-green dark:text-[#4ade80]" aria-hidden />
          CV&apos;nde ATS&apos;in okumasını zorlaştıracak bir biçim sorunu bulmadık.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {report.findings.map((b) => {
            const isProblem = b.severity === "problem"
            const Icon = isProblem ? OctagonAlert : TriangleAlert
            return (
              <li
                key={b.code}
                className={cn(
                  "flex gap-3 rounded-button border border-border border-l-4 bg-background/60 p-3.5",
                  isProblem ? "border-l-brand-red" : "border-l-brand-amber",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    isProblem ? "text-brand-red dark:text-[#f87171]" : "text-brand-amber",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="m-0 font-semibold">
                    <span className="sr-only">{isProblem ? "Sorun: " : "Uyarı: "}</span>
                    {b.title}
                  </p>
                  <p className="m-0 mt-0.5 text-sm text-muted">{b.description}</p>
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
          })}
        </ul>
      )}

      {report.passed.length > 0 && (
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted">
            Geçen kontroller
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {report.passed.map((g) => (
              <li key={g} className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted">
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
