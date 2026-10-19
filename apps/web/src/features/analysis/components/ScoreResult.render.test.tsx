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

  it("draws conditions and language levels in their own box, outside the counts (DOG-115)", () => {
    const withConditions: ScoreResultView = {
      ...result,
      requirements: [
        ...result.requirements,
        req("B sınıfı ehliyet", "condition", "matched"),
        req("Seyahat engeli olmayan", "condition", "missing"),
      ],
      languageChecks: [
        { index: 0, language: "İngilizce", required: "C1", cvLine: "İngilizce (B1)", found: "B1", status: "below" },
      ],
    }
    const html = renderToStaticMarkup(<ScoreResult result={withConditions} adapting={false} />)
    expect(html).toContain("Şartlar")
    expect(html).toContain("CV&#x27;nde: Excel")
    expect(html).toContain("Kontrol et")
    expect(html).toContain("İngilizce: ilan C1 seviyesi istiyor")
    expect(html).toContain("Hepsi · 2")
    expect(html).toContain("Eksik · 1")
  })

  it("draws an old analysis as before", () => {
    const html = renderToStaticMarkup(<ScoreResult result={{ ...result, scoringRevision: undefined }} adapting={false} />)
    expect(html).not.toContain("Mülakatta anlaşılacaklar")
    expect(html).not.toContain("Şartlar")
    expect(html).toContain("Hepsi · 3")
  })

  it("shows why a requirement is out and what the user corrected (DOG-90)", () => {
    const marked: ScoreResultView = {
      ...result,
      excluded: [1],
      exclusions: { 1: { reason: "irrelevant", scope: "profile" } },
      corrections: { 0: { terms: ["Excel", "Google Sheets"] } },
      reports: [{ index: 0, reason: "found_in_cv", at: "2026-10-18T00:00:00.000Z" }],
    }
    const html = renderToStaticMarkup(<ScoreResult result={marked} adapting={false} onRequirementChange={async () => {}} />)
    expect(html).toContain("Hariç tuttuğun kavramlar listende")
    expect(html).toContain("Şartı düzelttin: Excel, Google Sheets")
    expect(html).toContain("Bildirdin")
    expect(html).toContain("İlk skor 34")
  })
})
