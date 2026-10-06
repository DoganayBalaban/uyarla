import { describe, expect, it } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { preservesSource, summaryAnchors } from "./preserve.js"

const testPosting: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "React ve TypeScript",
      type: "skill",
      importance: "must",
      concepts: [
        { term: "React", synonyms: [] },
        { term: "TypeScript", synonyms: [] },
      ],
    },
  ],
}

const sourceText = "React ve TypeScript ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azalttım."

describe("preservesSource", () => {
  it("accepts a rewrite that adds the term next to the phrase", () => {
    expect(
      preservesSource({
        rewritten:
          "React ve TypeScript ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azaltarak web performansını iyileştirdim.",
        source: sourceText,
        posting: testPosting,
        bases: ["sayfa yüklenme süresini"],
      }).ok,
    ).toBe(true)
  })

  it("rejects a rewrite that replaces the basis with the term", () => {
    // Uçtan uca testte gerçekten üretilen cümle: anlam tersine dönmüştü.
    const outcome = preservesSource({
      rewritten: "React ve TypeScript ile satıcı panelini baştan yazarak web performansı %40 azalttım.",
      source: sourceText,
      posting: testPosting,
      bases: ["sayfa yüklenme süresini %40 azalttım"],
    })
    expect(outcome.ok).toBe(false)
  })

  it("rejects a rewrite that drops a posting concept present in the source", () => {
    const outcome = preservesSource({
      rewritten: "React ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azalttım.",
      source: sourceText,
      posting: testPosting,
    })
    expect(outcome).toEqual({ ok: false, reason: "ilan kavramı kayboldu: TypeScript" })
  })

  it("rejects a rewrite that drops a source number", () => {
    // Özet yazımı "4 yıllık deneyim"i düşürmüştü.
    const outcome = preservesSource({
      rewritten: "React ve TypeScript ile arayüz geliştiren bir geliştiriciyim.",
      source: "4 yıllık deneyime sahip, React ve TypeScript ile arayüz geliştiren bir geliştiriciyim.",
      posting: testPosting,
    })
    expect(outcome).toEqual({ ok: false, reason: "sayı kayboldu: 4" })
  })

  describe("verb inflection (eval:adapt, cv-c)", () => {
    const sourceText = "Öğrencilerin proje geliştirme süreçlerine teknik destek sağladım."
    const rewriteWith = (rewritten: string, basisText = "teknik destek sağladım.") =>
      preservesSource({ rewritten, source: sourceText, posting: testPosting, bases: [basisText] }).ok

    it("counts a verb turned into a conjunction as the basis", () => {
      expect(
        rewriteWith("Öğrencilerin proje geliştirme süreçlerine teknik destek sağlayarak problem çözme yetkinliklerini gösterdim."),
      ).toBe(true)
      expect(rewriteWith("Eğitim içeriklerini sürekli geliştirerek yeni gelişmeleri takip ettim.", "sürekli geliştirdim")).toBe(
        true,
      )
    })

    it("rejects a verb whose stem changes", () => {
      expect(
        rewriteWith(
          "Akademik personel ve öğrenciler arasında iletişim süreçlerini erişim yönetimi ile sağladım.",
          "iletişim süreçlerini yönettim.",
        ),
      ).toBe(false)
    })

    it("rejects a negated verb", () => {
      expect(rewriteWith("Öğrencilere teknik destek sağlamadım.")).toBe(false)
    })

    it("rejects a change in the word before the verb", () => {
      expect(
        rewriteWith("Organizasyon ve raporlama ile paydaş yönetimine katkı sağladım.", "ekip yönetimine katkı sağladım."),
      ).toBe(false)
    })
  })
})

describe("summaryAnchors", () => {
  // Gerçek vaka (6 Ekim 2026, yerel deneme): gpt-4.1-mini özeti genelleştirip
  // RAG, MCP, tool calling… terimlerini attı; skor 47 → 45 düştü.
  const original =
    "AI Engineer and Software Engineering graduate focused on production-grade LLM applications, RAG systems, AI agents, and full-stack AI products. Experienced in building enterprise assistants with retrieval, reranking, citations, tool calling, MCP integrations, evaluation, and privacy-aware AI workflows. Strong full-stack background with Python/FastAPI and React, with a focus on turning AI capabilities into reliable, usable products."
  const genericRewrite =
    "I am an AI Engineer with a background in Software Engineering and experience in developing AI assistants. I have worked extensively with software that includes embeddings, reranking, and REST APIs. My focus is on creating reliable AI products that integrate these technologies effectively."
  const skills = ["LLMs", "AI Agents", "RAG", "MCP", "reranking", "evaluation", "tool calling", "Python", "FastAPI", "React", "Docker", "LangChain"]
  const emptyPosting: JobPostingData = { position: "AI Engineer", company: null, seniority: null, language: "en", requirements: [] }

  it("lists the profile skills that the original summary mentions", () => {
    expect(summaryAnchors(original, skills)).toEqual(
      expect.arrayContaining(["RAG", "MCP", "reranking", "evaluation", "tool calling", "Python", "FastAPI", "React"]),
    )
    expect(summaryAnchors(original, skills)).not.toContain("Docker")
    expect(summaryAnchors(original, skills)).not.toContain("LangChain")
  })

  it("rejects a summary rewrite that drops the skills the original named", () => {
    const result = preservesSource({
      rewritten: genericRewrite,
      source: original,
      posting: emptyPosting,
      bases: summaryAnchors(original, skills),
    })
    expect(result.ok).toBe(false)
  })

  it("accepts a rewrite that keeps them", () => {
    const kept =
      "AI Engineer building production-grade LLM applications, RAG systems and AI agents: retrieval, reranking, citations, tool calling, MCP integrations and evaluation, with Python/FastAPI and React."
    expect(
      preservesSource({ rewritten: kept, source: original, posting: emptyPosting, bases: summaryAnchors(original, skills) }).ok,
    ).toBe(true)
  })
})

