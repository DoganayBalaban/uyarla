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

  it("tells evidence from a remembered fact apart from the CV (DOG-116)", () => {
    const fromFact = { ...req("Docker", "skill", "matched"), evidence: { text: "Docker Compose ile kurdum", kind: "bullet", fact: true } }
    const html = renderToStaticMarkup(
      <ScoreResult result={{ ...result, requirements: [fromFact], facts: [{ id: "a:c" }] }} adapting={false} />,
    )
    expect(html).toContain("Daha önce anlattığın 1 deneyim bu analizde kanıt sayıldı")
  })

  it("shows platform tips and a look-alike source warning once (DOG-95, DOG-125)", () => {
    const html = renderToStaticMarkup(
      <ScoreResult
        result={result}
        adapting={false}
        platform="greenhouse"
        sourceWarning={{ tone: "strong", text: "Bu ilanın adresi (evil-greenhouse.io) Greenhouse gibi görünüyor" }}
      />,
    )
    expect(html).toContain("evil-greenhouse.io")
    expect(html).toContain('role="alert"')
    expect(html).toContain("Bu ilan Greenhouse üzerinden")
    expect(html.match(/Bu ilanın adresi/g)).toHaveLength(1)
  })

  it("has a summary panel whose rows point at sections on the page (DOG-131)", () => {
    const html = renderToStaticMarkup(<ScoreResult result={result} adapting={false} />)
    expect(html).toContain('aria-label="Sonuç özeti"')
    expect(html).toContain("Zorunlu gereksinimler")
    expect(html).toContain("Görünmeyen kavramlar")
    for (const id of ["skor", "gereksinimler", "kavramlar"]) expect(html).toContain(`id="${id}"`)
  })

  it("offers the posting text tab and a 'show in posting' link (DOG-133)", () => {
    const html = renderToStaticMarkup(<ScoreResult result={result} adapting={false} postingText={"Aranan nitelikler\n• React deneyimi"} />)
    expect(html).toContain('role="tablist" aria-label="Sonuç görünümü"')
    expect(html).toContain("İlan metni")
    expect(html).toContain("İlanda göster")
    expect(renderToStaticMarkup(<ScoreResult result={result} adapting={false} />)).not.toContain("İlanda göster")
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
