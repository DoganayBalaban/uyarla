"use client"

import { Check, X } from "lucide-react"
import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { groupParts, type ScorePart } from "@/features/analysis/scoreParts"

const KIND_LABEL: Record<ScorePart["kind"], string> = {
  must: "Zorunlu",
  nice: "Tercih sebebi",
  generic: "Genel şart",
  title: "Unvan",
}

/**
 * Skorun parçaları: CV'de olanlar üstte, olmayanlar altta, her biri adıyla.
 * Neyin eksik olduğu üzerine gelmeden okunsun diye şerit değil satır. Kısmi
 * eşleşme "CV'nde var"da duruyor; rapor başlığı da onu karşılanmış sayıyor.
 */
export function ScoreBreakdown({ parts, onSelect }: { parts: ScorePart[]; onSelect?: (part: ScorePart) => void }) {
  if (parts.length === 0) return null
  const { met, missing } = groupParts(parts)
  // Kendi sağlayıcısıyla: kabuğun dışında (örnek rapor, testler) da çalışsın.
  return (
    <TooltipProvider delayDuration={150}>
      <section aria-label="Skorun parçaları" className="grid gap-6">
        {met.length > 0 && (
          <PartGroup
            icon={<Check aria-hidden className="size-4 text-brand-green dark:text-[#4ade80]" />}
            title="CV'nde var"
            parts={met}
            onSelect={onSelect}
          />
        )}
        {missing.length > 0 && (
          <PartGroup
            icon={<X aria-hidden className="size-4 text-brand-amber" />}
            title="CV'nde görünmüyor"
            parts={missing}
            onSelect={onSelect}
          />
        )}
      </section>
    </TooltipProvider>
  )
}

function PartGroup({
  icon,
  title,
  parts,
  onSelect,
}: {
  icon: ReactNode
  title: string
  parts: ScorePart[]
  onSelect?: (part: ScorePart) => void
}) {
  return (
    <div>
      <h2 className="m-0 mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <ul className="m-0 list-none p-0">
        {parts.map((part) => (
          <PartRow key={part.index ?? "title"} part={part} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  )
}

function PartRow({ part, onSelect }: { part: ScorePart; onSelect?: (part: ScorePart) => void }) {
  const partial = part.credit > 0 && part.credit < 1
  const status = part.credit >= 1 ? "karşılanıyor" : partial ? "kısmen karşılanıyor" : "CV'nde görünmüyor"
  const gain = part.gain > 0 ? `+${part.gain}` : null
  const note = partial ? ["kısmen", gain].filter(Boolean).join(" · ") : gain
  return (
    <li className="border-t">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect?.(part)}
            aria-label={`${part.label}: ${status}${gain ? `, karşılanırsa ${part.gain} puan` : ""}`}
            className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">{part.label}</span>
            {note && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{note}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-72 text-left">
          {KIND_LABEL[part.kind]}
          {gain && ` · karşılanırsa ${gain} puan`}
        </TooltipContent>
      </Tooltip>
    </li>
  )
}
