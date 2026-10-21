"use client"

import { useState } from "react"

/**
 * Unvan bulgusunun altındaki düzeltme (DOG-134): ilanın unvanı yanlış
 * okunduysa kullanıcı ilandaki unvanı yazıyor. Sunucu yalnızca ilan
 * metninde geçen unvanı kabul ediyor; CV hakkında bir beyan alınmıyor.
 */
const primary =
  "rounded-button bg-brand-blue px-3.5 py-2 font-semibold text-white transition hover:bg-brand-blue/90 disabled:opacity-50"
const secondary = "rounded-button px-3 py-2 font-semibold text-muted-foreground transition hover:text-foreground"

export function TitleCorrection({
  position,
  onSave,
}: {
  /** Şu an kullanılan ilan unvanı. */
  position: string
  /** Hata mesajıyla reddediliyor; mesaj formun altında gösteriliyor. */
  onSave: (position: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(position)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = value.trim()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(position)
          setError(null)
          setOpen(true)
        }}
        className="mt-2 text-xs font-semibold text-brand-blue underline-offset-2 hover:underline"
      >
        İlandaki unvan yanlış mı okunmuş? Düzelt
      </button>
    )
  }

  return (
    <form
      className="mt-3 rounded-button border border-border bg-card p-4 text-sm"
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
      <label className="block">
        <span className="text-muted-foreground">İlanda yazan unvan:</span>
        <input
          type="text"
          value={value}
          maxLength={120}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 w-full rounded-button border border-border bg-background px-2.5 py-1.5"
        />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        Yalnızca ilanın ne yazdığını düzeltiyorsun; unvan ilan metninde geçmeli. Skor CV&apos;ndekine göre yeniden
        hesaplanır.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={saving || !trimmed || trimmed === position} className={primary}>
          {saving ? "Hesaplanıyor…" : "Düzelt ve yeniden hesapla"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondary}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
