import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ScoreResult, type ScoreResultView } from "@/features/analysis/components/ScoreResult"

/** Duman testi: sonuç ekranı soft gereksinimleri ayrı blokta çiziyor (DOG-103). */
const req = (text: string, type: string, status: "matched" | "missing") => ({
  requirement: { text, importance: "must", type },
  status,
  confidence: status === "matched" ? 1 : 0,
  method: status === "matched" ? "keyword" : null,
  evidence: status === "matched" ? { text: "Excel", kind: "skill" } : null,
  missingConcepts: status === "matched" ? [] : [text],
})

const result: ScoreResultView = {
  score: 34,
  requirements: [req("MS Excel", "skill", "matched"), req("İş hukuku", "skill", "missing"), req("Takım çalışması", "soft", "missing")],
  missingKeywords: ["İş hukuku", "Takım çalışması"],
  titleMatch: { position: "İnsan Kaynakları Uzmanı", level: "none", resumeTitle: null },
  scoringRevision: 2,
}

describe("ScoreResult", () => {
  it("draws soft requirements apart, outside the counts, with the title line", () => {
    const html = renderToStaticMarkup(<ScoreResult result={result} adapting={false} />)
    expect(html).toContain("Mülakatta anlaşılacaklar")
    expect(html).toContain("İlandaki unvan CV&#x27;nde geçmiyor")
    expect(html).toContain("Hepsi · 2")
    expect(html).toContain("Eksik · 1")
    // K2: düşük skor "işe uygun değilim" diye okunuyordu.
    expect(html).toContain("işe uygunluğunu değil")
  })

  it("draws an old analysis as before", () => {
    const html = renderToStaticMarkup(<ScoreResult result={{ ...result, scoringRevision: undefined }} adapting={false} />)
    expect(html).not.toContain("Mülakatta anlaşılacaklar")
    expect(html).toContain("Hepsi · 3")
  })
})
