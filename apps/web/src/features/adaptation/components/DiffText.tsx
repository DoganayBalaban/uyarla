import { decisionParts } from "@/features/adaptation/diff"

/**
 * Kelime düzeyinde fark: eklenen yeşil vurgu, çıkarılan üstü çizili gri
 * (rehber §9.5). `decision` "rejected" ise yalnızca eski metin (DOG-166).
 */
export function DiffText({ original, rewritten, decision = "pending" }: { original: string; rewritten: string; decision?: string }) {
  return (
    <p className="m-0 leading-relaxed">
      {decisionParts(decision, original, rewritten).map((part, i) =>
        part.kind === "same" ? (
          <span key={i}>{part.text} </span>
        ) : (
          <span
            key={i}
            className={
              part.kind === "added"
                ? "rounded bg-brand-green/15 px-0.5 text-foreground decoration-brand-green/60 underline-offset-2"
                : "text-muted-foreground line-through decoration-muted-foreground/60"
            }
          >
            {part.text}{" "}
          </span>
        ),
      )}
    </p>
  )
}
