import { highlightParts, type PostingTerm } from "@/features/adaptation/postingTerms"

/** Metinde ilan terimleri vurgulu (DOG-92). */
export function HighlightedText({ text, terms }: { text: string; terms: readonly PostingTerm[] }) {
  return (
    <>
      {highlightParts(text, terms).map((p, i) =>
        p.term ? (
          <mark key={i} className="rounded bg-brand-blue/15 px-0.5 text-foreground">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
