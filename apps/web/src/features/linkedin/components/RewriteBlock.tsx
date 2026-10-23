"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Copy, ExternalLink, Lock, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { diffWords } from "@/features/adaptation/diff"
import { plansPath } from "@/features/billing/paywall"
import { cn } from "@/lib/cn"

const LINKEDIN_PROFILE = "https://www.linkedin.com/in/me/"

type Suggestion = { text: string; verification: { status: "ok" | "flagged"; issues: Array<{ kind: string; detail: string }> } }

/** Kopyala düğmesi: metni panoya yazar, "LinkedIn'de yapıştır" der. */
export function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          toast.success("Kopyalandı; LinkedIn'de yapıştır.")
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          toast.error("Kopyalayamadık; metni seçip kopyalayabilirsin.")
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Kopyalandı" : label}
    </Button>
  )
}

/** Kilitli yazım (DOG-157): gerçek metin sunucudan gelmiyor; bulanık iskelet ve paket bağlantısı. */
export function LockedRewrite() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-dashed bg-muted/30 p-4">
      <div aria-hidden className="space-y-2 blur-[2px]">
        {[92, 78, 85, 60].map((w) => (
          <span key={w} className="block h-2 rounded-full bg-muted-foreground/20" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 bg-background/60 p-3 text-center">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Lock className="size-4 text-primary" aria-hidden /> Önerin hazır; paketle açılır.
        </span>
        <Button asChild size="sm">
          <Link href={plansPath("/linkedin")}>Paketleri gör</Link>
        </Button>
      </div>
    </div>
  )
}

/** "Şu anki" ve "Önerimiz": değişen kelimeler vurgulu, karakter sayacı, kopyala. */
export function RewriteBlock({ current, suggestion, maxChars }: { current: string | null; suggestion: Suggestion; maxChars?: number }) {
  // Kelime farkı satır sonlarını da bölüyor; maddeli (çok satırlı) öneri satırlarıyla, farksız gösteriliyor.
  const parts = current && !suggestion.text.includes("\n") ? diffWords(current, suggestion.text) : null
  return (
    <div className="space-y-3">
      {current && (
        <div>
          <p className="m-0 text-xs font-semibold text-muted-foreground">Şu anki</p>
          <p className="m-0 mt-1 text-sm whitespace-pre-line text-muted-foreground">{current}</p>
        </div>
      )}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-xs font-semibold text-primary">Önerimiz</p>
          <span className={cn("text-xs tabular-nums", maxChars && suggestion.text.length > maxChars ? "text-destructive" : "text-muted-foreground")}>
            {suggestion.text.length}
            {maxChars ? ` / ${maxChars}` : ""} karakter
          </span>
        </div>
        <p className="m-0 mt-1 text-sm whitespace-pre-line">
          {parts
            ? parts.map((p, i) =>
                p.kind === "removed" ? null : (
                  <span key={i} className={p.kind === "added" ? "rounded bg-primary/15 px-0.5" : undefined}>
                    {p.text}{" "}
                  </span>
                ),
              )
            : suggestion.text}
        </p>
        {suggestion.verification.status === "flagged" && (
          <p className="m-0 mt-2 flex items-start gap-1.5 text-xs text-brand-amber">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {suggestion.verification.issues.map((i) => i.detail).join(" ")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={suggestion.text} />
          <Button asChild size="sm" variant="ghost">
            <a href={LINKEDIN_PROFILE} target="_blank" rel="noreferrer">
              LinkedIn'de aç <ExternalLink aria-hidden />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
