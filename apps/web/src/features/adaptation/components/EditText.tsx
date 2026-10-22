"use client"

import { useEffect, useRef, useState } from "react"
import { Pencil, TriangleAlert } from "lucide-react"
import type { Verification } from "@/features/adaptation/types"
import { termsIn, type PostingTerm } from "@/features/adaptation/postingTerms"

/** Sunucuyla aynı sınır (core adapt/edit); istemciye core'u çekmemek için ayrı. */
const EDIT_MAX_LENGTH = 1000

/**
 * Önerinin metnini elle düzenleme (DOG-92). Kaydedince yeni hâl kullanıcının
 * metni oluyor; uydurma kontrolü ve skor sunucuda, LLM'siz.
 */
export function EditText({
  text,
  edited,
  busy,
  onSave,
  terms = [],
  onPreview,
  currentScore = null,
}: {
  text: string
  edited?: boolean
  busy: boolean
  /** İlan terimleri (DOG-92): yazarken metinde geçenler canlı gösteriliyor. */
  terms?: readonly PostingTerm[]
  /** Yazarken canlı skor (DOG-92): kaydetmeden bu metinle skor ve kontrol. */
  onPreview?: (text: string, signal: AbortSignal) => Promise<{ scoreAfter: number | null; verification: Verification | null }>
  /** Şu anki "sonra" skoru; önizlemeyle karşılaştırılıyor. */
  currentScore?: number | null
  onSave: (text: string) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const preview = useLivePreview(draft, text, onPreview)

  if (draft === null) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => {
            setError(null)
            setDraft(text)
          }}
          disabled={busy}
          className="inline-flex items-center gap-1.5 font-semibold text-brand-blue disabled:opacity-50"
        >
          <Pencil className="size-3.5" aria-hidden />
          Düzenle
        </button>
        {edited && <span className="text-muted-foreground">Yeni hâli senin düzenlemen.</span>}
      </div>
    )
  }

  async function save() {
    const failed = await onSave(draft!)
    setError(failed)
    if (!failed) setDraft(null)
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={EDIT_MAX_LENGTH}
        rows={3}
        aria-label="Yeni hâlin metni"
        className="w-full rounded-button border border-border bg-background p-2 text-sm leading-relaxed"
      />
      {terms.length > 0 && <LiveTerms text={draft} terms={terms} />}
      {onPreview && <LiveScore preview={preview} currentScore={currentScore} />}
      <p className="m-0 text-xs text-muted-foreground">
        CV&apos;nde olmayan bir sayı ya da ilan terimi eklersen &ldquo;kontrol et&rdquo; uyarısı çıkar; mülakatta
        savunabileceğin şeyleri yaz.
      </p>
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !draft.trim()}
          className="rounded-button bg-brand-blue px-4 py-1.5 font-semibold text-white disabled:opacity-50"
        >
          Kaydet
        </button>
        <button type="button" onClick={() => setDraft(null)} disabled={busy} className="px-3 py-1.5 font-semibold text-muted-foreground">
          Vazgeç
        </button>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
    </div>
  )
}

/** Yazarken metinde geçen ilan terimleri; eşleşme skorlamayla aynı. */
function LiveTerms({ text, terms }: { text: string; terms: readonly PostingTerm[] }) {
  const found = termsIn(text, terms)
  return (
    <p className="m-0 text-xs text-muted-foreground" aria-live="polite">
      {found.length === 0 ? (
        "Bu metinde ilanın terimlerinden biri geçmiyor."
      ) : (
        <>
          İlanın terimleri:{" "}
          {found.map((t) => (
            <span key={t.term} className="mr-1 inline-block rounded bg-brand-blue/15 px-1.5 py-0.5 text-foreground">
              {t.term}
            </span>
          ))}
        </>
      )}
    </p>
  )
}

/** Önizleme skorunun şu ankinden farkı; biri yoksa null. */
export function scoreDelta(preview: number | null, current: number | null): number | null {
  return preview !== null && current !== null ? Math.round(preview) - Math.round(current) : null
}

/** Önizleme gerekli mi: metin boş değil ve kaydedilenden farklı. */
export function needsPreview(draft: string | null, original: string): draft is string {
  return draft !== null && draft.trim() !== "" && draft.trim() !== original.trim()
}

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; scoreAfter: number | null; verification: Verification | null }
  | { state: "error" }

/** Yazmaya ara verince (0,8 sn) bir önizleme; yeni yazı öncekini iptal ediyor. */
function useLivePreview(draft: string | null, original: string, onPreview: Parameters<typeof EditText>[0]["onPreview"]): Preview {
  const [preview, setPreview] = useState<Preview>({ state: "idle" })
  // Ebeveyn her render'da yeni işlev veriyor (sayfa yokluyor); önizleme
  // yalnızca metin değişince gitsin.
  const latest = useRef(onPreview)
  latest.current = onPreview
  const enabled = !!onPreview
  useEffect(() => {
    if (!enabled || !needsPreview(draft, original)) {
      setPreview({ state: "idle" })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setPreview({ state: "loading" })
      latest.current!(draft, controller.signal)
        .then((r) => setPreview({ state: "done", ...r }))
        .catch(() => {
          if (!controller.signal.aborted) setPreview({ state: "error" })
        })
    }, 800)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [draft, original, enabled])
  return preview
}

function LiveScore({ preview, currentScore }: { preview: Preview; currentScore: number | null }) {
  if (preview.state === "idle") return null
  if (preview.state === "loading") return <p className="m-0 text-xs text-muted-foreground">Skoru hesaplıyoruz…</p>
  if (preview.state === "error") return <p className="m-0 text-xs text-muted-foreground">Skoru şimdi hesaplayamadık; kaydedince güncellenir.</p>
  const score = preview.scoreAfter
  const diff = scoreDelta(score, currentScore)
  return (
    <div className="space-y-1" aria-live="polite">
      {score !== null && (
        <p className="m-0 text-xs">
          Bu metinle skor: <span className="font-semibold">{score}</span>
          {diff !== null && diff !== 0 && (
            <span className={diff > 0 ? "text-brand-green dark:text-[#4ade80]" : "text-brand-red dark:text-[#f87171]"}>
              {" "}
              ({diff > 0 ? "+" : ""}
              {diff})
            </span>
          )}
          {diff === 0 && <span className="text-muted-foreground"> (değişmiyor)</span>}
        </p>
      )}
      {preview.verification?.status === "flagged" && (
        <p className="m-0 flex gap-1.5 text-xs text-brand-amber">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Kontrol et: {preview.verification.issues.map((i) => i.detail).join(" ")}</span>
        </p>
      )}
    </div>
  )
}
