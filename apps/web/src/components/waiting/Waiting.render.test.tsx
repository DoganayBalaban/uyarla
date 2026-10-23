import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AnalysisWaiting } from "@/features/analysis/components/AnalysisWaiting"
import { AdaptationWaiting } from "@/features/adaptation/components/AdaptationWaiting"
import { InterviewPrepWaiting } from "@/features/applications/components/InterviewPrepWaiting"
import { LinkedInAuditWaiting } from "@/features/linkedin/components/LinkedInAuditWaiting"

const text = (html: string) => html.replace(/<[^>]+>/g, " ")

describe("AnalysisWaiting", () => {
  it("shows the stage being worked on and the user's own posting lines", () => {
    const html = renderToStaticMarkup(
      <AnalysisWaiting
        stage="reading_posting"
        input={{ resumeLabel: "cv.pdf", resumeLines: null, postingLines: ["Frontend Geliştirici", "React ile 3 yıl deneyim"] }}
      />,
    )
    expect(html).toContain("İlanı okuyoruz")
    expect(html).toContain("Frontend Geliştirici")
    expect(html).toContain("React ile 3 yıl deneyim")
    expect(html).toContain("cv.pdf")
    expect(html).toContain('aria-current="step"')
  })

  it("draws a skeleton when the form is gone (page reload) and starts at the first stage", () => {
    const html = renderToStaticMarkup(<AnalysisWaiting stage={null} />)
    expect(html).toContain("CV&#x27;ni okuyoruz")
    expect(html).toContain("CV&#x27;n")
  })

  it("keeps the last stage on screen when the worker already said completed", () => {
    expect(renderToStaticMarkup(<AnalysisWaiting stage="completed" />)).toContain("İlanla karşılaştırıyoruz")
  })

  it("never shows a made-up percentage or remaining time", () => {
    for (const stage of [null, "reading_resume", "reading_posting", "comparing"]) {
      const shown = text(renderToStaticMarkup(<AnalysisWaiting stage={stage} />))
      expect(shown).not.toMatch(/%|kaldı/)
    }
  })
})

describe("AdaptationWaiting", () => {
  const preview = {
    headline: "Performans pazarlama uzmanı",
    lines: ["Meta kampanyalarını yönettim."],
    missing: ["Google Analytics 4", "Excel pivot tablo"],
    startedAt: "2026-10-22T10:00:00.000Z",
  }

  it("shows the CV being rewritten, the score before and the missing concepts", () => {
    const html = renderToStaticMarkup(<AdaptationWaiting stage="rewriting" scoreBefore={34} preview={preview} />)
    expect(html).toContain("CV&#x27;ni ilana göre yeniden yazıyoruz")
    expect(html).toContain("Meta kampanyalarını yönettim.")
    expect(html).toContain("Önceki skor 34")
    expect(html).toContain("Google Analytics 4")
    expect(html).toContain("dayanağı olmayan eklenmez")
  })

  it("moves to the check stage and still renders without a preview", () => {
    const html = renderToStaticMarkup(<AdaptationWaiting stage="verifying" scoreBefore={null} preview={null} />)
    expect(html).toContain("Hiçbir şeyin uydurulmadığını kontrol ediyoruz")
    expect(html).not.toContain("Eksik kavram kalmadı")
    expect(html).not.toContain("Önceki skor")
  })

  it("says nothing is missing only when the analysis really left nothing missing", () => {
    const html = renderToStaticMarkup(<AdaptationWaiting stage="rewriting" scoreBefore={60} preview={{ ...preview, missing: [] }} />)
    expect(html).toContain("Eksik kavram kalmadı")
  })
})

describe("LinkedInAuditWaiting", () => {
  const profile = {
    name: "Deniz Aksoy",
    headline: "Pazarlama",
    about: null,
    experience: [{ title: "Uzman", company: "Acme", dateRange: null, location: null, description: null }],
    education: [],
    certifications: [],
    skills: [],
    languages: [],
    truncated: {},
  }

  it("draws the real headline and roles while checking sections, h2 under the page title", () => {
    const html = renderToStaticMarkup(<LinkedInAuditWaiting audit={{ stage: "checking", createdAt: "2026-10-22T12:00:00.000Z", profile }} />)
    expect(html).toContain("Bölümleri kontrol ediyoruz")
    expect(html).toContain("Deniz Aksoy")
    expect(html).toContain("Uzman")
    expect(html).toMatch(/<h2[^>]*>Bölümleri kontrol ediyoruz<\/h2>/)
  })

  it("draws a skeleton while a PDF is still being read", () => {
    const html = renderToStaticMarkup(<LinkedInAuditWaiting audit={{ stage: "reading", createdAt: "2026-10-22T12:00:00.000Z", profile: null }} />)
    expect(html).toContain("Profilini okuyoruz")
  })
})

describe("InterviewPrepWaiting", () => {
  it("lists the unmet requirements the bridges are written for", () => {
    const html = renderToStaticMarkup(
      <InterviewPrepWaiting stage="writing" preview={{ lines: ["Ay sonu kapanışlarını yaptım."], gaps: ["SAP deneyimi"] }} />,
    )
    expect(html).toContain("Olası soruları ve cevap iskeletlerini yazıyoruz")
    expect(html).toContain("Ay sonu kapanışlarını yaptım.")
    expect(html).toContain("SAP deneyimi")
    expect(html).toContain("Davranışsal")
  })

  it("has no unmet-requirements box when there are none or the preview is missing", () => {
    for (const preview of [null, { lines: [], gaps: [] }]) {
      expect(renderToStaticMarkup(<InterviewPrepWaiting stage="reading" preview={preview} />)).not.toContain("karşılanmayan şartları")
    }
  })
})
