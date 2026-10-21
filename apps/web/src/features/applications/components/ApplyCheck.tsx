"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { BoardCard } from "@/features/applications/board"

/**
 * Başvuru kapısı (DOG-91): skor düşükken "önce uyarlamak ister misin?".
 * Durdurmuyor; uyarlama "Uyarla"daki akışla (giriş ve paket dönüşü dahil).
 */
export function ApplyCheck({ card, onApply, onClose }: { card: BoardCard; onApply: () => void; onClose: () => void }) {
  const r = card.readiness!
  const gaps = [
    r.missingMust > 0 ? `${r.missingMust} zorunlu gereksinim CV'nde görünmüyor` : null,
    r.titleMissing ? "ilandaki unvan CV'nde geçmiyor" : null,
  ].filter(Boolean)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-check-title"
        className="w-full max-w-md rounded-card border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 id="apply-check-title" className="m-0 text-lg">
          Önce uyarlamak ister misin?
        </h2>
        <p className="mt-2 text-sm text-muted">
          {card.position}: {gaps.join("; ")}. Deneyiminde varsa uyarlamada görünür kılabiliriz; olmayan bir şeyi
          eklemiyoruz.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/analyze?uyarla=${encodeURIComponent(card.analysisId)}`}
            autoFocus
            className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-4 py-2.5 font-semibold text-white no-underline"
          >
            Önce uyarla
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onApply}
            className="rounded-button border border-border px-4 py-2.5 text-sm font-semibold hover:border-foreground/25"
          >
            Yine de başvurdum
          </button>
          <button type="button" onClick={onClose} className="px-3 py-2.5 text-sm font-semibold text-muted">
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  )
}
