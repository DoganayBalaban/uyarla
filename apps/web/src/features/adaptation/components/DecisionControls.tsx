"use client"

import { Check, TriangleAlert } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Verification } from "@/features/adaptation/types"

/**
 * Yeni/eski hâl seçimi: iki seçenekli tek seçimli grup (DOG-146 ile shadcn
 * ToggleGroup). Ekran okuyucu için tek bir soru; seçili olana yeniden
 * basmak seçimi kaldırmıyor.
 */
export function DecisionToggle({
  val,
  canPickNew = true,
  busy,
  onSelect,
  labels = { accepted: "Yeni hâli", rejected: "Eski hâli" },
}: {
  val: string
  canPickNew?: boolean
  busy: boolean
  onSelect: (d: "accepted" | "rejected") => void
  /** Katkılarda "CV'ye ekle / Ekleme" (DOG-94). */
  labels?: { accepted: string; rejected: string }
}) {
  const options = [
    ...(canPickNew ? [{ d: "accepted" as const, label: labels.accepted }] : []),
    { d: "rejected" as const, label: labels.rejected },
  ]
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={val === "accepted" || val === "rejected" ? val : ""}
      onValueChange={(v) => {
        if (v === "accepted" || v === "rejected") onSelect(v)
      }}
      disabled={busy}
      aria-label="Hangi hâli kullanılsın?"
    >
      {options.map((s) => (
        <ToggleGroupItem
          key={s.d}
          value={s.d}
          className="gap-1.5 px-3"
        >
          {val === s.d && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
          {s.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function VerificationWarning({ v }: { v: Verification }) {
  if (v.status !== "flagged") return null
  return (
    <div role="note" className="mb-3 flex gap-2.5 rounded-lg border border-brand-amber/30 bg-brand-amber/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
      <div>
        <p className="m-0 font-semibold text-brand-amber">Kontrol et</p>
        {v.issues.map((issue, i) => (
          <p className="m-0 mt-0.5 text-foreground/80" key={i}>
            {issue.detail}
          </p>
        ))}
      </div>
    </div>
  )
}
