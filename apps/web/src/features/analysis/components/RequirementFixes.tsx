"use client"

import { useId, useState } from "react"
import { LoaderCircle } from "lucide-react"
import type { ExclusionReason } from "@uyarla/core/score/exclusions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/cn"
import { parseTerms, REASON_OPTIONS } from "@/features/analysis/requirementFix"

/**
 * Gereksinim satırının düzeltme formları (DOG-90): işaretin nedeni ve
 * ilanın yanlış okunmuş şartı. Satırın açtığı diyalogda çiziliyor (DOG-146);
 * başlığı diyalog veriyor.
 */

export function MarkPanel({
  saving,
  onSubmit,
  onCancel,
}: {
  saving: boolean
  onSubmit: (mark: { reason: ExclusionReason; always: boolean }) => void
  onCancel: () => void
}) {
  const id = useId()
  const [reason, setReason] = useState<ExclusionReason>("not_in_posting")
  const [always, setAlways] = useState(false)
  const option = REASON_OPTIONS.find((o) => o.value === reason)!

  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ reason, always: option.canRemember && always })
      }}
    >
      <RadioGroup value={reason} onValueChange={(v) => setReason(v as ExclusionReason)} aria-label="Bu şartta ne sorun var?">
        {REASON_OPTIONS.map((o) => (
          <Label
            key={o.value}
            htmlFor={`${id}-${o.value}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
          >
            <RadioGroupItem id={`${id}-${o.value}`} value={o.value} className="mt-0.5" />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      <Label className={cn("flex items-center gap-2 font-normal", !option.canRemember && "opacity-40")}>
        <Checkbox
          checked={option.canRemember && always}
          disabled={!option.canRemember}
          onCheckedChange={(v) => setAlways(v === true)}
        />
        Bundan sonraki ilanlarda da hariç tut
      </Label>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
          {reason === "found_in_cv" ? "Bildir" : "Skordan çıkar"}
        </Button>
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
  const id = useId()
  const [years, setYears] = useState(initialYears ? String(initialYears) : "")
  const [terms, setTerms] = useState(initialTerms.join(", "))
  const parsedYears = Number(years)
  const validYears = Number.isInteger(parsedYears) && parsedYears >= 1 && parsedYears <= 40
  const parsedTerms = parseTerms(terms)
  const valid = kind === "years" ? validYears : parsedTerms.length > 0

  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit(kind === "years" ? { minYears: parsedYears } : { terms: parsedTerms })
      }}
    >
      {kind === "years" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="font-normal">
            İlan en az
          </Label>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="w-20"
            aria-label="İstenen en az yıl"
          />
          <span>yıl deneyim istiyor.</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="font-normal text-muted-foreground">
            İlanın kabul ettiği bölüm ya da dereceler, virgülle ayır:
          </Label>
          <Input
            id={id}
            type="text"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Bilgisayar Mühendisliği, ilgili bölümler"
          />
        </div>
      )}
      <p className="m-0 text-xs text-muted-foreground">
        Yalnızca ilanın ne istediğini düzeltiyorsun; skor CV&apos;ndekine göre yeniden hesaplanır.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Vazgeç
        </Button>
        {corrected && (
          <Button type="button" variant="outline" disabled={saving} onClick={onRemove}>
            Düzeltmeyi kaldır
          </Button>
        )}
        <Button type="submit" disabled={saving || !valid}>
          {saving && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
          {saving ? "Hesaplanıyor…" : "Düzelt ve yeniden hesapla"}
        </Button>
      </div>
    </form>
  )
}
