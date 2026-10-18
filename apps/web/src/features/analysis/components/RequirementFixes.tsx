"use client"

import { useState } from "react"
import type { ExclusionReason } from "@uyarla/core/score/exclusions"
import { cn } from "@/lib/cn"
import { parseTerms, REASON_OPTIONS } from "@/features/analysis/requirementFix"

/**
 * Gereksinim satırının düzeltme panelleri (DOG-90): işaretin nedeni ve
 * ilanın yanlış okunmuş şartı. Satırın altında açılıyor; sayfa değişmiyor.
 */

const panel = "mt-3 ml-8 rounded-button border border-border bg-background p-4 text-sm"
const primary =
  "rounded-button bg-brand-blue px-3.5 py-2 font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-50"
const secondary = "rounded-button px-3 py-2 font-semibold text-muted transition hover:text-foreground"

export function MarkPanel({
  saving,
  onSubmit,
  onCancel,
}: {
  saving: boolean
  onSubmit: (mark: { reason: ExclusionReason; always: boolean }) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<ExclusionReason>("not_in_posting")
  const [always, setAlways] = useState(false)
  const option = REASON_OPTIONS.find((o) => o.value === reason)!

  return (
    <form
      className={panel}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ reason, always: option.canRemember && always })
      }}
    >
      <fieldset>
        <legend className="mb-2 font-semibold">Bu şartta ne sorun var?</legend>
        <div className="space-y-1.5">
          {REASON_OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="reason"
                value={o.value}
                checked={reason === o.value}
                onChange={() => setReason(o.value)}
                className="mt-1 accent-brand-blue"
              />
              <span>
                <span className="font-medium">{o.label}</span>
                <span className="block text-xs text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={cn("mt-3 flex items-center gap-2", !option.canRemember && "opacity-40")}>
        <input
          type="checkbox"
          checked={option.canRemember && always}
          disabled={!option.canRemember}
          onChange={(e) => setAlways(e.target.checked)}
          className="accent-brand-blue"
        />
        Bundan sonraki ilanlarda da hariç tut
      </label>
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving} className={primary}>
          {reason === "found_in_cv" ? "Bildir" : "Skordan çıkar"}
        </button>
        <button type="button" onClick={onCancel} className={secondary}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}

export function CorrectPanel({
  kind,
  initialYears,
  initialTerms,
  corrected,
  saving,
  onSubmit,
  onRemove,
  onCancel,
}: {
  kind: "years" | "terms"
  initialYears?: number
  initialTerms: string[]
  corrected: boolean
  saving: boolean
  onSubmit: (change: { minYears?: number; terms?: string[] }) => void
  onRemove: () => void
  onCancel: () => void
}) {
  const [years, setYears] = useState(initialYears ? String(initialYears) : "")
  const [terms, setTerms] = useState(initialTerms.join(", "))
  const parsedYears = Number(years)
  const validYears = Number.isInteger(parsedYears) && parsedYears >= 1 && parsedYears <= 40
  const parsedTerms = parseTerms(terms)
  const valid = kind === "years" ? validYears : parsedTerms.length > 0

  return (
    <form
      className={panel}
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit(kind === "years" ? { minYears: parsedYears } : { terms: parsedTerms })
      }}
    >
      <p className="mb-2 font-semibold">İlanı yanlış mı okuduk?</p>
      {kind === "years" ? (
        <label className="flex flex-wrap items-center gap-2">
          İlan en az
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="w-20 rounded-button border border-border bg-card px-2.5 py-1.5"
            aria-label="İstenen en az yıl"
          />
          yıl deneyim istiyor.
        </label>
      ) : (
        <label className="block">
          <span className="text-muted">İlanın kabul ettiği bölüm ya da dereceler, virgülle ayır:</span>
          <input
            type="text"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Bilgisayar Mühendisliği, ilgili bölümler"
            className="mt-1.5 w-full rounded-button border border-border bg-card px-2.5 py-1.5"
          />
        </label>
      )}
      <p className="mt-2 text-xs text-muted">
        Yalnızca ilanın ne istediğini düzeltiyorsun; skor CV&apos;ndekine göre yeniden hesaplanır.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={saving || !valid} className={primary}>
          {saving ? "Hesaplanıyor…" : "Düzelt ve yeniden hesapla"}
        </button>
        {corrected && (
          <button type="button" disabled={saving} onClick={onRemove} className={secondary}>
            Düzeltmeyi kaldır
          </button>
        )}
        <button type="button" onClick={onCancel} className={secondary}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
