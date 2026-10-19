import mammoth from "mammoth"
import { describe, it, expect } from "vitest"
import { extractText } from "../documents/extractText.js"
import { segmentResume } from "../extract/segment.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { renderDocx } from "./docx.js"
import { toDocumentModel } from "./model.js"
import { renderPdf } from "./pdf.js"

/**
 * İndirilen belge ATS'ten geçmeli (spec §9): yeni düzen (sağa yaslı tarih,
 * etiketli beceri satırları, bağlantılar, DOG-106) kendi okuyucumuzla geri
 * okunduğunda bölümler, sıra ve beceri kategorileri yerinde kalmalı.
 */
const profile: ResumeProfile = {
  fullName: "Elif Yılmaz",
  headline: "AI Engineer · İstanbul · elif@ornek.com · github.com/elif · elif.dev",
  summary: "LLM tabanlı ürünler geliştiren yazılımcı.",
  experience: [
    {
      company: "Acme Teknoloji",
      title: "AI Engineer",
      startDate: "2023-01",
      endDate: "halen",
      bullets: [
        { text: "RAG altyapısını kurdum ve geri getirme doğruluğunu ölçtüm.", sourceRef: "x" },
        { text: "Kaynak kodu https://github.com/elif/rag adresinde.", sourceRef: "y" },
      ],
    },
    {
      company: "Beta Yazılım",
      title: "Backend Developer",
      startDate: "2021-06",
      endDate: "2022-12",
      bullets: [{ text: "FastAPI ile servisler yazdım.", sourceRef: "z" }],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar Mühendisliği", startDate: "2017", endDate: "2021" }],
  skills: ["RAG", "LLMs", "Python", "FastAPI", "Docker"],
  skillGroups: [
    { name: "AI / LLM", items: ["LLMs", "RAG"] },
    { name: "Backend", items: ["Python", "FastAPI"] },
  ],
  languages: ["İngilizce (C1)"],
  certifications: [],
  sectionOrder: ["skills", "experience", "education"],
}

describe("downloaded resume round trip (DOG-106)", () => {
  for (const format of ["pdf", "docx"] as const) {
    it(`${format}: sections come back in the resume's order and skill categories survive`, async () => {
      const model = toDocumentModel(profile)
      const buffer = format === "pdf" ? await renderPdf(model) : await renderDocx(model)
      const text = await extractText(buffer, `cikti.${format}`)
      const segments = segmentResume(text)

      expect(segments.sectionOrder).toEqual(["skills", "experience", "education"])
      expect(segments.skillsBlock).toContain("AI / LLM: RAG, LLMs")
      expect(segments.skillsBlock).toContain("Backend: Python, FastAPI")
      expect(segments.skillsBlock).toContain("Docker")
      expect(segments.experienceBlock).toContain("FastAPI ile servisler yazdım.")
      expect(segments.educationBlock).toContain("İTÜ")
      expect(segments.headerBlock).toContain("elif@ornek.com")
    })

    it(`${format}: each entry reads title, company, date, then its bullets`, async () => {
      const text = await extractText(
        format === "pdf" ? await renderPdf(toDocumentModel(profile)) : await renderDocx(toDocumentModel(profile)),
        `cikti.${format}`,
      )
      const order = ["AI Engineer", "Acme Teknoloji", "2023-01 - halen", "RAG altyapısını", "Backend Developer", "Beta Yazılım", "2021-06 - 2022-12", "FastAPI ile"]
      const positions = order.map((s) => text.indexOf(s, text.indexOf("DENEYİM")))
      expect(positions.every((p) => p >= 0)).toBe(true)
      expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    })
  }

  for (const format of ["pdf", "docx"] as const) {
    it(`${format}: no year is joined to a Unicode dash in the text layer (DOG-114)`, async () => {
      const text = await extractText(
        format === "pdf" ? await renderPdf(toDocumentModel(profile)) : await renderDocx(toDocumentModel(profile)),
        `cikti.${format}`,
      )
      expect(text).toContain("2017 - 2021")
      expect(text).not.toMatch(/(19|20)\d{2}(-\d{2})?\s*[\u2010-\u2015\u2212]/)
    })
  }

  it("pdf: e-mail, GitHub, portfolio and a URL in a bullet are clickable", async () => {
    const raw = (await renderPdf(toDocumentModel(profile))).toString("latin1")
    for (const href of ["mailto:elif@ornek.com", "https://github.com/elif", "https://elif.dev", "https://github.com/elif/rag"]) {
      expect(raw).toContain(`(${href})`)
    }
  })

  it("docx: the same links are hyperlinks", async () => {
    const { value: html } = await mammoth.convertToHtml({ buffer: await renderDocx(toDocumentModel(profile)) })
    for (const href of ["mailto:elif@ornek.com", "https://github.com/elif", "https://elif.dev", "https://github.com/elif/rag"]) {
      expect(html).toContain(`href="${href}"`)
    }
  })
})
