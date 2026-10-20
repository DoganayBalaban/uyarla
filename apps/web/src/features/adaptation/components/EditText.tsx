"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
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
}: {
  text: string
  edited?: boolean
  busy: boolean
  /** İlan terimleri (DOG-92): yazarken metinde geçenler canlı gösteriliyor. */
  terms?: readonly PostingTerm[]
  onSave: (text: string) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        {edited && <span className="text-muted">Yeni hâli senin düzenlemen.</span>}
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
      <p className="m-0 text-xs text-muted">
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
        <button type="button" onClick={() => setDraft(null)} disabled={busy} className="px-3 py-1.5 font-semibold text-muted">
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
    <p className="m-0 text-xs text-muted" aria-live="polite">
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
