"use client"

import { useState } from "react"
import { Check, Copy, LoaderCircle, MessageSquareText, TriangleAlert } from "lucide-react"
import { MAX_FOLLOW_UPS_PER_KIND, type FollowUpChannel, type FollowUpKind } from "@uyarla/core/cover/followUpRecord"
import type { BoardCard } from "@/features/applications/board"
import { useRequestFollowUp } from "@/features/applications/api"
import { apiErrorMessage } from "@/lib/api"

const LABEL: Record<FollowUpKind, { open: string; write: string }> = {
  followup: { open: "Takip mesajı", write: "Takip mesajı yaz" },
  thanks: { open: "Teşekkür notu", write: "Teşekkür notu yaz" },
}

/** Kartın aşamasına göre önerilen taslak: başvurulduysa takip, mülakattaysa teşekkür (DOG-117). */
export function followUpKindFor(card: Pick<BoardCard, "stage">): FollowUpKind | null {
  if (card.stage === "applied") return "followup"
  if (card.stage === "interview") return "thanks"
  return null
}

/**
 * Takip mesajı ve teşekkür notu taslağı (DOG-117). Kaynak başvurunun
 * gönderilen CV'si ve ön yazısı; yeni iddia eklenmiyor. Biz göndermiyoruz:
 * kullanıcı kopyalayıp kendisi gönderiyor.
 */
export function FollowUpPanel({ card }: { card: BoardCard }) {
  const kind = followUpKindFor(card)
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<FollowUpChannel>("email")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRequestFollowUp()
  if (!kind) return null

  const drafts = card.followUps.filter((f) => f.kind === kind)
  const latest = drafts.at(-1)
  const used = drafts.filter((f) => f.status !== "failed").length
  const left = MAX_FOLLOW_UPS_PER_KIND - used
  const running = latest?.status === "running"

  async function write() {
    setError(null)
    setCopied(false)
    try {
      await request.mutateAsync({ analysisId: card.analysisId, kind: kind!, channel })
    } catch (e) {
      setError(await apiErrorMessage(e, "Taslağı başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  async function copy() {
    if (!latest?.text) return
    await navigator.clipboard.writeText(latest.subject ? `${latest.subject}\n\n${latest.text}` : latest.text)
    setCopied(true)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <MessageSquareText className="size-3.5" aria-hidden />
        {LABEL[kind].open}
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-button border border-border bg-background p-3 text-sm">
      <p className="m-0 text-muted">
        {kind === "followup"
          ? "Gönderdiğin CV ve ön yazıdan, yeni bir şey eklemeden kısa bir takip mesajı."
          : "Mülakat sonrası kısa bir teşekkür notu. Köşeli parantezli yere görüşmeden bir konu yaz ya da sil."}{" "}
        Göndermeden önce oku; biz göndermiyoruz.
      </p>

      {running && (
        <p className="mt-2 flex items-center gap-2 text-muted" role="status">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
          Yazıyoruz…
        </p>
      )}
      {latest?.status === "failed" && <p className="mt-2 text-brand-red">Taslağı yazamadık. Tekrar dener misin?</p>}
      {latest?.status === "done" && latest.text && (
        <div className="mt-2">
          {latest.verification?.status === "flagged" && (
            <p className="m-0 mb-2 flex gap-1.5 text-brand-amber">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {latest.verification.issues.map((i) => i.detail.replace("Bu paragrafta", "Bu taslakta")).join(" ")}
            </p>
          )}
          {latest.subject && (
            <p className="m-0 mb-1">
              <span className="font-semibold">Konu:</span> {latest.subject}
            </p>
          )}
          <p className="m-0 whitespace-pre-line rounded-[8px] bg-card p-2.5 leading-relaxed">{latest.text}</p>
          <button
            type="button"
            onClick={() => void copy()}
            className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-blue dark:text-brand-blue-light"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
      )}

      {!running && left > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as FollowUpChannel)}
            aria-label="Kanal"
            className="rounded-button border border-border bg-card px-2 py-1.5"
          >
            <option value="email">E-posta</option>
            <option value="linkedin">LinkedIn mesajı</option>
          </select>
          <button
            type="button"
            onClick={() => void write()}
            disabled={request.isPending}
            className="rounded-button bg-brand-blue px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {latest ? "Yeniden yaz" : LABEL[kind].write}
          </button>
          {latest && <span className="text-xs text-muted">{left} hakkın kaldı</span>}
        </div>
      )}
      {!running && left <= 0 && <p className="mt-2 text-xs text-muted">Bu başvuru için taslak hakkın doldu.</p>}
      {error && (
        <p role="alert" className="mt-2 text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
    </div>
  )
}
