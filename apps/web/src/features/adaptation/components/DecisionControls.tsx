"use client"

import { Check, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/cn"
import type { Verification } from "@/features/adaptation/types"

/**
 * Yeni/eski hâl seçimi. 21st.dev'deki "segmented control" desenleri gibi
 * iki seçenekli bir radyo grubu: ekran okuyucu için de tek bir soru.
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
    <div role="radiogroup" aria-label="Hangi hâli kullanılsın?" className="inline-flex rounded-button bg-background p-1 text-sm">
      {options.map((s) => {
        const selected = val === s.d
        return (
          <button
            key={s.d}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={busy || selected}
            onClick={() => onSelect(s.d)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 font-semibold transition disabled:cursor-default",
              selected ? "bg-card text-brand-blue shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

export function VerificationWarning({ v }: { v: Verification }) {
  if (v.status !== "flagged") return null
  return (
    <div className="mb-3 flex gap-2.5 rounded-button bg-brand-amber/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
      <div>
        <p className="m-0 font-semibold text-brand-amber">Kontrol et</p>
        {v.issues.map((problemCount, i) => (
          <p className="m-0 mt-0.5 text-foreground/80" key={i}>
            {problemCount.detail}
          </p>
        ))}
      </div>
    </div>
  )
}
