"use client"

import { Check, LoaderCircle, X } from "lucide-react"
import { useState, type ReactNode } from "react"
import type { Declaration, DeclareTarget } from "@uyarla/core/adapt/declarations"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { RequirementAction } from "@/features/analysis/api"
import { DeclareForm } from "@/features/analysis/components/DeclareForm"
import { groupParts, type ScorePart } from "@/features/analysis/scoreParts"

const KIND_LABEL: Record<ScorePart["kind"], string> = {
  must: "Zorunlu",
  nice: "Tercih sebebi",
  generic: "Genel şart",
  title: "Unvan",
}

/** "Bende var" (K-114). Örnek raporda yok: orada değişiklik yapılamıyor. */
export interface DeclareProps {
  declarations: Declaration[]
  /** Uyarlama başladı: analiz başına tek uyarlama var, beyan artık değişmiyor. */
  locked: boolean
  targets: DeclareTarget[]
  onChange: (index: number, change: RequirementAction) => Promise<void>
}

/**
 * Skorun parçaları: CV'de olanlar üstte, olmayanlar altta, her biri adıyla.
 * Neyin eksik olduğu üzerine gelmeden okunsun diye şerit değil satır. Kısmi
 * eşleşme "CV'nde var"da duruyor; rapor başlığı da onu karşılanmış sayıyor.
 */
export function ScoreBreakdown({
  parts,
  onSelect,
  declare,
}: {
  parts: ScorePart[]
  onSelect?: (part: ScorePart) => void
  declare?: DeclareProps
}) {
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
            declare={declare}
          />
        )}
        {missing.length > 0 && (
          <PartGroup
            icon={<X aria-hidden className="size-4 text-brand-amber" />}
            title="CV'nde görünmüyor"
            parts={missing}
            onSelect={onSelect}
            declare={declare}
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
  declare,
}: {
  icon: ReactNode
  title: string
  parts: ScorePart[]
  onSelect?: (part: ScorePart) => void
  declare?: DeclareProps
}) {
  return (
    <div>
      <h2 className="m-0 mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      <ul className="m-0 list-none p-0">
        {parts.map((part) => (
          <PartRow key={part.index ?? "title"} part={part} onSelect={onSelect} declare={declare} />
        ))}
      </ul>
    </div>
  )
}

function PartRow({
  part,
  onSelect,
  declare,
}: {
  part: ScorePart
  onSelect?: (part: ScorePart) => void
  declare?: DeclareProps
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const partial = part.credit > 0 && part.credit < 1
  const status = part.credit >= 1 ? "karşılanıyor" : partial ? "kısmen karşılanıyor" : "CV'nde görünmüyor"
  const gain = part.gain > 0 ? `+${part.gain}` : null
  const note = partial ? ["kısmen", gain].filter(Boolean).join(" · ") : gain

  const index = part.index
  const declaration = index === null ? undefined : declare?.declarations.find((d) => d.requirementIndex === index)
  const declarable = !!declare && index !== null && part.credit < 1 && canDeclare(part, declare.targets)
  const offer = declarable && !declare.locked && !declaration

  const send = async (change: RequirementAction) => {
    if (index === null || !declare) return
    setSaving(true)
    try {
      await declare.onChange(index, change)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }
  // Hata üstte gösteriliyor (AnalyzeView); burada yalnızca yutuluyor.
  const sendQuietly = (change: RequirementAction) => void send(change).catch(() => {})

  return (
    <li className="border-t">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onSelect?.(part)}
              aria-label={`${part.label}: ${status}${gain ? `, karşılanırsa ${part.gain} puan` : ""}`}
              className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
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
        {offer && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={saving}
            aria-expanded={open}
            aria-label={`${part.label}: Bende var`}
            onClick={() => {
              if (part.type === "skill" && part.missing.length === 1) {
                sendQuietly({ action: "declare", declaration: { kind: "skill", terms: part.missing } })
              } else setOpen((o) => !o)
            }}
          >
            {saving && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
            Bende var
          </Button>
        )}
        {declaration && (
          <span className="shrink-0 text-xs text-brand-green dark:text-[#4ade80]">
            sen ekledin
            {!declare?.locked && (
              <>
                {" · "}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => sendQuietly({ action: "undeclare" })}
                  className="underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  geri al
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {declaration && part.credit === 0 && (
        <p className="m-0 pb-2 text-xs text-muted-foreground">Eklendi, CV&apos;ne girecek; bu şart skoru değiştirmedi.</p>
      )}
      {declarable && declare.locked && !declaration && (
        <p className="m-0 pb-2 text-xs text-muted-foreground">Uyarlama ekranından madde ekleyebilirsin.</p>
      )}
      {open && offer && (
        <DeclareForm
          part={part}
          targets={declare.targets}
          onCancel={() => setOpen(false)}
          onSubmit={(input) => send({ action: "declare", declaration: input })}
        />
      )}
    </li>
  )
}

/** Unvan CV'de yazan bir gerçek; cümlenin yazılacağı iş yoksa deneyim de eklenemiyor. */
function canDeclare(part: ScorePart, targets: DeclareTarget[]): boolean {
  if (part.type === "skill" || part.type === "education") return true
  return part.type === "experience" && targets.length > 0
}
