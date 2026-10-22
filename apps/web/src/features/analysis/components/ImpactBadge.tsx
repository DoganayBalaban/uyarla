import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/cn"
import type { ScoreImpact } from "@/features/analysis/scoreImpact"

/**
 * Bölüm başlığının yanındaki skor etkisi rozeti (DOG-132). Dayanağı fareyle
 * üzerine gelince, ekran okuyucuda etiketle birlikte okunuyor.
 */
export function ImpactBadge({ impact, className }: { impact: ScoreImpact; className?: string }) {
  return (
    <Badge
      title={impact.hint}
      variant={impact.tone === "scored" ? "secondary" : "outline"}
      className={cn(
        "align-middle text-[11px] font-semibold",
        impact.tone === "scored" ? "bg-primary/10 text-primary" : "text-muted-foreground",
        className,
      )}
    >
      {impact.label}
      <span className="sr-only">: {impact.hint}</span>
    </Badge>
  )
}
