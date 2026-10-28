import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loopMs } from "@/features/landing/demos/demoScript"
import { APPLY_PHASES, APPLY_SCENE, BOARD_GATE_MS, BOARD_PHASES, BOARD_SCENE, INTERVIEW_PHASES, INTERVIEW_SCENE, JOB_PHASES, LINKEDIN_PHASES, LINKEDIN_SCENE, CHECK_PHASES } from "@/features/landing/demos/scenes"
import { JobSearchDemo, JobSearchFilm } from "@/features/landing/demos/JobSearchDemo"
import { ApplyFilm } from "@/features/landing/demos/ApplyDemo"
import { BoardFilm } from "@/features/landing/demos/BoardDemo"
import { InterviewFilm } from "@/features/landing/demos/InterviewDemo"
import { LinkedInFilm } from "@/features/landing/demos/LinkedInDemo"
import { CheckFilm } from "@/features/landing/demos/CheckFilm"

/** Her sahne son karesinde (hareket azaltma) anlamlı metni gösteriyor. */
describe("scenes (DOG-160)", () => {
  it("job search ends with the four sites and the query", () => {
    const html = renderToStaticMarkup(<JobSearchFilm ms={loopMs(JOB_PHASES) - 1} />)
    for (const label of ["Kariyer.net", "LinkedIn", "Jooble", "Careerjet"]) expect(html).toContain(label)
    expect(html).toContain("frontend geliştirici react")
    expect(renderToStaticMarkup(<JobSearchDemo />)).toContain('role="figure"')
  })

  it("apply ends copied, within the limit, with the CV source", () => {
    const html = renderToStaticMarkup(<ApplyFilm ms={loopMs(APPLY_PHASES) - 1} />)
    expect(html).toContain("Kopyalandı")
    expect(html).toContain("Sınır içinde")
    expect(html).toContain(`${APPLY_SCENE.answer.length}/140`)
    expect(html).toContain("CV&#x27;nden")
  })

  it("board ends in the interview column with a thank-you draft", () => {
    const html = renderToStaticMarkup(<BoardFilm ms={loopMs(BOARD_PHASES) - 1} />)
    for (const label of ["Kaydedildi", "Başvuruldu", "Mülakat", "Teklif", "Olmadı"]) expect(html).toContain(label)
    expect(html).toContain("[ad]")
    expect(html).toContain(">41<")
    const gate = renderToStaticMarkup(<BoardFilm ms={BOARD_GATE_MS} />)
    expect(gate).toContain("Önce uyarlamak ister misin?")
    expect(gate).toContain(`${BOARD_SCENE.missingMust} zorunlu gereksinim CV&#x27;nde görünmüyor`)
  })

  it("interview ends with STAR feedback and the not-on-paper flag", () => {
    const html = renderToStaticMarkup(<InterviewFilm ms={loopMs(INTERVIEW_PHASES) - 1} />)
    expect(html).toContain("Kâğıtta yok")
    expect(html).toContain(INTERVIEW_SCENE.notOnPaper)
    expect(html).toContain("Sonuç")
  })

  it("linkedin ends with the rewritten headline, its sources and the coming-soon extension", () => {
    const html = renderToStaticMarkup(<LinkedInFilm ms={loopMs(LINKEDIN_PHASES) - 1} />)
    expect(html).toContain("Başlık")
    expect(html).toContain("Geliştirilebilir")
    for (const p of LINKEDIN_SCENE.parts) expect(html).toContain(p.text)
    expect(html).toContain("Hedef rolün")
    expect(html).toContain("Yakında")
  })

  it("uses the product's own wording and sources (son inceleme)", () => {
    const linkedin = renderToStaticMarkup(<LinkedInFilm ms={loopMs(LINKEDIN_PHASES) - 1} />)
    expect(linkedin).toContain("Frontend Geliştirici | React, TypeScript, Kod incelemesi")
    expect(linkedin).toContain("Başlığında hedef unvanın")
    expect(linkedin).toContain("Profilinde:")
    expect(linkedin).not.toContain("CV: ")
    const gate = renderToStaticMarkup(<BoardFilm ms={BOARD_GATE_MS} />)
    expect(gate).toContain("Yine de başvurdum")
    expect(gate).toContain("Önce uyarla")
  })

  it("lets the visitor pause a scene (WCAG 2.2.2)", () => {
    expect(renderToStaticMarkup(<JobSearchDemo />)).toContain('aria-label="Sahneyi duraklat"')
  })

  it("check film flags the overstated bullet, then unlocks the download once decided (DOG-162)", () => {
    const first = renderToStaticMarkup(<CheckFilm ms={500} />)
    expect(first).toContain("Kontrol et")
    expect(first).toContain("liderlik")
    expect(first).toContain("İşaretli maddeye karar verene kadar indirme kapalı.")
    const last = renderToStaticMarkup(<CheckFilm ms={loopMs(CHECK_PHASES) - 1} />)
    expect(last).toContain("Eski hâli kalacak")
    expect(last).toContain("Karar verildi, indirme açık.")
  })
})
