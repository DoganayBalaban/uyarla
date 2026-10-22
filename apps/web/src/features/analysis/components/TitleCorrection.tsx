"use client"

import { useId, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Unvan bulgusunun altındaki düzeltme (DOG-134): ilanın unvanı yanlış
 * okunduysa kullanıcı ilandaki unvanı yazıyor. Sunucu yalnızca ilan
 * metninde geçen unvanı kabul ediyor; CV hakkında bir beyan alınmıyor.
 */
export function TitleCorrection({
  position,
  onSave,
}: {
  /** Şu an kullanılan ilan unvanı. */
  position: string
  /** Hata mesajıyla reddediliyor; mesaj formun altında gösteriliyor. */
  onSave: (position: string) => Promise<void>
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(position)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = value.trim()

  if (!open) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={() => {
          setValue(position)
          setError(null)
          setOpen(true)
        }}
        className="mt-1 h-auto px-0 text-xs"
      >
        İlandaki unvan yanlış mı okunmuş? Düzelt
      </Button>
    )
  }

  return (
    <form
      className="mt-3 space-y-3 rounded-lg border bg-card p-4 text-sm"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!trimmed) return
        setSaving(true)
        setError(null)
        try {
          await onSave(trimmed)
          setOpen(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : "Yeniden hesaplayamadık.")
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={id} className="font-normal text-muted-foreground">
          İlanda yazan unvan:
        </Label>
        <Input id={id} type="text" value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} />
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Yalnızca ilanın ne yazdığını düzeltiyorsun; unvan ilan metninde geçmeli. Skor CV&apos;ndekine göre yeniden
        hesaplanır.
      </p>
      {error && (
        <p role="alert" className="m-0 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving || !trimmed || trimmed === position}>
          {saving && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
          {saving ? "Hesaplanıyor…" : "Düzelt ve yeniden hesapla"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  )
}
