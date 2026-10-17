"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/cn"
import { DiffText } from "@/features/adaptation/components/DiffText"
import { documentSections, type DocumentLine } from "@/features/adaptation/documentView"
import type { DocumentOutline, Draft } from "@/features/adaptation/types"

type Mode = "diff" | "after" | "before"

const MODES: { mode: Mode; label: string }[] = [
  { mode: "diff", label: "Farklar" },
  { mode: "after", label: "Sonra" },
  { mode: "before", label: "Önce" },
]

/**
 * CV'nin tamamı, deneyim bazında (DOG-93). "Değişiklikler" görünümü maddeleri
 * bağlamsız listeliyor ("Madde 3"); burada her madde kendi işinin altında.
 *
 * "Sonra" indirilecek belgenin aynısı: sunucu indirmenin kullandığı
 * applyAdaptation ile üretiyor. Karar bekleyen maddeler orada da eski hâliyle
 * duruyor, burada ayrıca işaretleniyor.
 */
export function DocumentView({
  document,
  draft,
}: {
  document: { before: DocumentOutline; after: DocumentOutline }
  draft: Pick<Draft, "bullets">
}) {
  const [mode, setMode] = useState<Mode>("diff")
  const s = documentSections(document, draft)

  const text = (l: DocumentLine) =>
    mode === "diff" && l.changed ? (
      <DiffText original={l.before} rewritten={l.after} />
    ) : (
      <p className="m-0 leading-relaxed">{mode === "before" ? l.before : l.after}</p>
    )

  return (
    <section className="rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg">Belge</h2>
        <div role="radiogroup" aria-label="Belgenin hangi hâli" className="inline-flex rounded-button bg-background p-1 text-sm">
          {MODES.map((m) => {
            const selected = mode === m.mode
            return (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m.mode)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 font-semibold transition",
                  selected ? "bg-card text-brand-blue shadow-sm" : "text-muted hover:text-foreground",
                )}
              >
                {selected && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {mode === "diff"
          ? "İndireceğin CV, değişen yerler işaretli."
          : mode === "after"
            ? "İndireceğin CV, seçtiğin hâllerle."
            : "Yüklediğin CV, uyarlamadan önce."}
      </p>

      <div className="mt-5 flex flex-col gap-6 rounded-button border border-border bg-background/60 p-4 text-sm sm:p-6">
        {s.headline && <p className="m-0 font-semibold text-muted">{s.headline}</p>}

        {s.summary && (
          <div>
            <h3 className="m-0 mb-2 text-xs font-bold tracking-wider text-muted uppercase">Özet</h3>
            {text(s.summary)}
          </div>
        )}

        {s.experience.length > 0 && (
          <div>
            <h3 className="m-0 mb-3 text-xs font-bold tracking-wider text-muted uppercase">Deneyim</h3>
            <div className="space-y-5">
              {s.experience.map((job, i) => (
                <div key={i}>
                  <p className="m-0 font-semibold">
                    {job.title}
                    {job.company && <span className="font-normal text-muted"> · {job.company}</span>}
                  </p>
                  {job.dates && <p className="m-0 text-xs text-muted">{job.dates}</p>}
                  <ul className="mt-2 list-disc space-y-1.5 pl-5">
                    {job.bullets.map((b, j) => (
                      <li key={j}>
                        {text(b)}
                        {b.pending && mode !== "before" && (
                          <span className="mt-0.5 block text-xs font-medium text-brand-blue">
                            Karar bekliyor; yeni hâlini seçmezsen bu madde eski hâliyle kalır.
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projeler henüz uyarlanmıyor; önce ve sonra aynı (DOG-105). */}
        {(document.after.projects?.length ?? 0) > 0 && (
          <div>
            <h3 className="m-0 mb-3 text-xs font-bold tracking-wider text-muted uppercase">Projeler</h3>
            <div className="space-y-4">
              {document.after.projects!.map((p, i) => (
                <div key={i}>
                  <p className="m-0 font-semibold">
                    {p.name}
                    {p.role && <span className="font-normal text-muted"> · {p.role}</span>}
                  </p>
                  {p.dates && <p className="m-0 text-xs text-muted">{p.dates}</p>}
                  {p.bullets.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1.5 pl-5">
                      {p.bullets.map((b, j) => (
                        <li key={j} className="leading-relaxed">
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {s.skills.length > 0 && (
          <div>
            <h3 className="m-0 mb-2 text-xs font-bold tracking-wider text-muted uppercase">Beceriler</h3>
            <ul className="flex flex-wrap gap-1.5">
              {(mode === "before" ? document.before.skills.map((name) => ({ name, added: false })) : s.skills).map((k) => (
                <li
                  key={k.name}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5",
                    mode === "diff" && k.added ? "border-brand-green/40 bg-brand-green/15" : "border-border bg-card",
                  )}
                >
                  {k.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(document.after.otherSections ?? []).map((o, i) => (
          <div key={i}>
            <h3 className="m-0 mb-2 text-xs font-bold tracking-wider text-muted uppercase">{o.heading}</h3>
            {o.lines.map((l, j) => (
              <p key={j} className="m-0 leading-relaxed">
                {l}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
