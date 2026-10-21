"use client"

import { useState } from "react"
import { Check, Copy, LoaderCircle, MessageSquareText, TriangleAlert } from "lucide-react"
import {
  MAX_FOLLOW_UPS_PER_KIND,
  OUTREACH_NOTE_MAX_LENGTH,
  type FollowUpChannel,
  type FollowUpKind,
  type FollowUpRecord,
  type OutreachPurpose,
  type OutreachRecipient,
} from "@uyarla/core/cover/followUpRecord"
import type { BoardCard } from "@/features/applications/board"
import { useRequestFollowUp } from "@/features/applications/api"
import { apiErrorMessage } from "@/lib/api"

const LABEL: Record<FollowUpKind, { open: string; write: string }> = {
  followup: { open: "Takip mesajı", write: "Takip mesajı yaz" },
  thanks: { open: "Teşekkür notu", write: "Teşekkür notu yaz" },
  outreach: { open: "Ağ kurma mesajı", write: "Mesaj yaz" },
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
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
      >
        <MessageSquareText className="size-3.5" aria-hidden />
        {LABEL[kind].open}
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="m-0 text-muted-foreground">
        {kind === "followup"
          ? "Gönderdiğin CV ve ön yazıdan, yeni bir şey eklemeden kısa bir takip mesajı."
          : "Mülakat sonrası kısa bir teşekkür notu. Köşeli parantezli yere görüşmeden bir konu yaz ya da sil."}{" "}
        Göndermeden önce oku; biz göndermiyoruz.
      </p>

      {running && (
        <p className="mt-2 flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
          Yazıyoruz…
        </p>
      )}
      {latest?.status === "failed" && <p className="mt-2 text-destructive">Taslağı yazamadık. Tekrar dener misin?</p>}
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
          <p className="m-0 whitespace-pre-line rounded-md border bg-card p-3 leading-relaxed">{latest.text}</p>
          <button
            type="button"
            onClick={() => void copy()}
            className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary"
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
            className="h-8 rounded-md border border-input bg-transparent px-2 shadow-xs"
          >
            <option value="email">E-posta</option>
            <option value="linkedin">LinkedIn mesajı</option>
          </select>
          <button
            type="button"
            onClick={() => void write()}
            disabled={request.isPending}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {latest ? "Yeniden yaz" : LABEL[kind].write}
          </button>
          {latest && <span className="text-xs text-muted-foreground">{left} hakkın kaldı</span>}
        </div>
      )}
      {!running && left <= 0 && <p className="mt-2 text-xs text-muted-foreground">Bu başvuru için taslak hakkın doldu.</p>}
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

const RECIPIENTS: Array<[OutreachRecipient, string]> = [
  ["recruiter", "İşe alım sorumlusu"],
  ["team", "Ekipten biri ya da yönetici"],
  ["contact", "Şirkette bir tanıdık"],
]
const PURPOSES: Array<[OutreachPurpose, string]> = [
  ["introduce", "İlgimi ve başvurumu iletmek"],
  ["ask", "Rol ya da süreç hakkında soru"],
  ["chat", "Kısa bir görüşme rica etmek"],
]

/**
 * Ağ kurma mesajı (DOG-99): şirketten birine kısa bir LinkedIn mesajı ya da
 * e-posta. Kaynak gönderilen belgeler ve kullanıcının verdiği bağlam; alıcının
 * adı yerine "[ad]" kalıyor, ortak geçmiş uydurulmuyor. Başvurmadan önce ya
 * da sonra.
 */
export function OutreachPanel({ card }: { card: BoardCard }) {
  const [open, setOpen] = useState(false)
  const [channel, setChannel] = useState<FollowUpChannel>("linkedin")
  const [recipient, setRecipient] = useState<OutreachRecipient>("recruiter")
  const [purpose, setPurpose] = useState<OutreachPurpose>("introduce")
  const [note, setNote] = useState("")
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRequestFollowUp()
  if (card.stage !== "saved" && card.stage !== "applied") return null

  const drafts = card.followUps.filter((f) => f.kind === "outreach")
  const latest: FollowUpRecord | undefined = drafts.at(-1)
  const left = MAX_FOLLOW_UPS_PER_KIND - drafts.filter((f) => f.status !== "failed").length
  const running = latest?.status === "running"

  async function write() {
    setError(null)
    setCopied(false)
    try {
      await request.mutateAsync({ analysisId: card.analysisId, kind: "outreach", channel, recipient, purpose, note: note.trim() || undefined })
    } catch (e) {
      setError(await apiErrorMessage(e, "Mesajı başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
      >
        <MessageSquareText className="size-3.5" aria-hidden />
        {LABEL.outreach.open}
      </button>
    )
  }

  const select = "h-8 rounded-md border border-input bg-transparent px-2 shadow-xs"
  return (
    <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="m-0 text-muted-foreground">
        Şirketten birine kısa bir mesaj. Alıcının adını &ldquo;[ad]&rdquo; yerine sen yaz; ortak bir geçmişiniz varsa
        aşağıya ekle, biz uydurmuyoruz. Göndermeden önce oku.
      </p>

      {running && (
        <p className="mt-2 flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
          Yazıyoruz…
        </p>
      )}
      {latest?.status === "failed" && <p className="mt-2 text-destructive">Mesajı yazamadık. Tekrar dener misin?</p>}
      {latest?.status === "done" && latest.text && (
        <div className="mt-2">
          {latest.verification?.status === "flagged" && (
            <p className="m-0 mb-2 flex gap-1.5 text-brand-amber">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {latest.verification.issues.map((i) => i.detail.replace("Bu paragrafta", "Bu mesajda")).join(" ")}
            </p>
          )}
          {latest.subject && (
            <p className="m-0 mb-1">
              <span className="font-semibold">Konu:</span> {latest.subject}
            </p>
          )}
          <p className="m-0 whitespace-pre-line rounded-md border bg-card p-3 leading-relaxed">{latest.text}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(latest.subject ? `${latest.subject}\n\n${latest.text}` : latest.text!)
                .then(() => setCopied(true))
            }}
            className="mt-2 inline-flex items-center gap-1.5 font-medium text-primary"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
      )}

      {!running && left > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select value={recipient} onChange={(e) => setRecipient(e.target.value as OutreachRecipient)} aria-label="Kime" className={select}>
              {RECIPIENTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as OutreachPurpose)} aria-label="Amaç" className={select}>
              {PURPOSES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select value={channel} onChange={(e) => setChannel(e.target.value as FollowUpChannel)} aria-label="Kanal" className={select}>
              <option value="linkedin">LinkedIn mesajı</option>
              <option value="email">E-posta</option>
            </select>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={OUTREACH_NOTE_MAX_LENGTH}
            aria-label="Ortak bağlam (isteğe bağlı)"
            placeholder="İsteğe bağlı: ortak bir bağlam, ör. aynı üniversiteden mezunuz"
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 shadow-xs"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void write()}
              disabled={request.isPending}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {latest ? "Yeniden yaz" : LABEL.outreach.write}
            </button>
            {latest && <span className="text-xs text-muted-foreground">{left} hakkın kaldı</span>}
          </div>
        </div>
      )}
      {!running && left <= 0 && <p className="mt-2 text-xs text-muted-foreground">Bu başvuru için mesaj hakkın doldu.</p>}
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
