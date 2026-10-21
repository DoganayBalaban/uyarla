import { cn } from "@/lib/cn"
import type { ScoreImpact } from "@/features/analysis/scoreImpact"

/**
 * Bölüm başlığının yanındaki skor etkisi rozeti (DOG-132). Dayanağı fareyle
 * üzerine gelince, ekran okuyucuda etiketle birlikte okunuyor.
 */
export function ImpactBadge({ impact, className }: { impact: ScoreImpact; className?: string }) {
  return (
    <span
      title={impact.hint}
      className={cn(
        "inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-semibold whitespace-nowrap",
        impact.tone === "scored"
          ? "bg-brand-blue/10 text-brand-blue"
          : "border border-border bg-background text-muted",
        className,
      )}
    >
      {impact.label}
      <span className="sr-only">: {impact.hint}</span>
    </span>
  )
}
