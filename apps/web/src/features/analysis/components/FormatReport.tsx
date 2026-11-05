"use client"

import Link from "next/link"
import { Check, ChevronDown, CircleCheck, OctagonAlert, TriangleAlert, Wand2 } from "lucide-react"
import type { FormatFinding, FormatReport } from "@uyarla/core/format/check"
import { cn } from "@/lib/cn"
import { fixHint } from "@/features/analysis/formatFixes"
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
 * Analiz raporunun diğer bölümleri gibi kartsız: çizgiyle ayrılan satırlar,
 * seviye ikonun renginde ve ekran okuyucuya metinle. Skor etkisi rozet
 * değil, formülden gelen tek cümle.
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

  const counts = [
    problemCount > 0 ? `${problemCount} sorun` : null,
    warningCount > 0 ? `${warningCount} uyarı` : null,
    `${report.passed.length} kontrol geçti`,
  ].filter(Boolean)

  return (
    <section className="border-t pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="m-0 text-lg font-semibold tracking-tight">CV kontrolü</h2>
        <p className="m-0 text-sm text-muted-foreground tabular-nums">{counts.join(", ")}</p>
      </div>
      <p className="m-0 mt-1 max-w-prose text-sm text-muted-foreground">
        Başvuru sistemleri CV&apos;ni doğru okuyabilir mi, işe alımcı ne görüyor?
        {impact && ` ${impact.hint}`}
      </p>

      {report.findings.length === 0 ? (
        <p className="m-0 mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4" aria-hidden />
          CV&apos;nde ATS&apos;in okumasını zorlaştıracak ya da işe alımcının gözüne batacak bir sorun bulmadık.
        </p>
      ) : (
        <>
          {readability.length > 0 && (
            <ul className="m-0 mt-4 list-none divide-y border-y p-0">
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
            <div className="mt-6">
              <h3 className="m-0 text-sm font-semibold">İşe alımcı gözüyle</h3>
              <ul className="m-0 mt-2 list-none divide-y border-y p-0">
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
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
            {report.passed.map((g) => (
              <li key={g} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Check className="size-3.5" aria-hidden />
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
    <li className="flex gap-3 py-4">
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", isProblem ? "text-brand-red dark:text-[#f87171]" : "text-brand-amber")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="m-0 font-medium">
          <span className="sr-only">{isProblem ? "Sorun: " : "Uyarı: "}</span>
          {b.title}
        </p>
        <p className="m-0 mt-0.5 max-w-prose text-sm text-muted-foreground">
          {b.description}
          {impact && <span className="text-foreground"> {impact.hint}</span>}
        </p>
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
    </li>
  )
}
