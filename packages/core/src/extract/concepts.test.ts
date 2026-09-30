import { describe, it, expect } from "vitest"
import { splitIntoConcepts } from "./concepts.js"

const termList = (text: string) => splitIntoConcepts(text).map((c) => c.term)

describe("splitIntoConcepts · from real postings", () => {
  it("splits a compound requirement separated by commas and 've'", () => {
    expect(termList("Python, REST API, SQL ve NoSQL veri tabanları konusunda deneyim")).toEqual([
      "Python", "REST API", "SQL", "NoSQL veri tabanları",
    ])
  })

  it("splits a five-part requirement completely", () => {
    // Model bu gereksinimde yalnızca 1 kavram çıkarıyordu.
    expect(
      termList("Generative AI Yetkinlikleri, OpenAI, Azure OpenAI, Anthropic Claude ve Gemini API"),
    ).toEqual(["Generative AI", "OpenAI", "Azure OpenAI", "Anthropic Claude", "Gemini API"])
  })

  it("does not split CI/CD in two", () => {
    expect(termList("Git ve CI/CD deneyimi")).toEqual(["Git", "CI/CD"])
  })

  it("also splits the list after a colon", () => {
    expect(
      termList("4+ years of production software engineering: APIs, services, testing, CI/CD"),
    ).toEqual(["production software engineering", "APIs", "services", "testing", "CI/CD"])
  })

  it("drops a leading duration phrase", () => {
    expect(termList("En az 3 yıl React deneyimi")).toEqual(["React"])
    expect(termList("At least 2 years of Kubernetes experience")).toEqual(["Kubernetes"])
  })

  it("drops English filler patterns and treats an 'or' list as options", () => {
    const [conceptItem, ...excess] = splitIntoConcepts(
      "Hands on with LangChain, LangGraph, or equivalent agent frameworks",
    )
    expect(excess).toHaveLength(0)
    expect(conceptItem!.term).toBe("LangChain / LangGraph / agent")
    expect(conceptItem!.synonyms).toEqual(["LangChain", "LangGraph", "agent"])
  })

  it("'ile' makes tool and task separate concepts and drops trailing filler", () => {
    expect(termList("Kubernetes ile konteyner yönetimi zorunludur")).toEqual([
      "Kubernetes", "konteyner yönetimi",
    ])
  })

  it("treats the whole text as one concept when no concept is found", () => {
    // "5 yıl deneyim" gibi gereksinimlerde aranacak somut bir terim yok;
    // skorlamanın yine de en az bir kavrama ihtiyacı var.
    const k = termList("Benzer bir işte en az 5 yıl deneyim sahibi olmak")
    expect(k).toHaveLength(1)
    expect(k[0]).toContain("5 yıl")
  })

  it("does not return the same term twice", () => {
    expect(termList("Docker ve Docker Compose")).toEqual(["Docker", "Docker Compose"])
  })

  it("returns a single concept for empty text", () => {
    expect(splitIntoConcepts("   ")).toHaveLength(1)
  })
})

/**
 * Uçtan uca testte çöp kavram üreten gereksinimler (K-38). İki ilan: fintech
 * frontend ve e-ticaret performans pazarlama.
 */
describe("splitIntoConcepts · Turkish constructions", () => {
  const conceptItem = (text: string, kindName?: Parameters<typeof splitIntoConcepts>[1]) =>
    splitIntoConcepts(text, kindName)

  it("drops the duration and filler after 'ile'", () => {
    expect(termList("React ve TypeScript ile en az 4 yıl profesyonel deneyim")).toEqual([
      "React", "TypeScript",
    ])
  })

  it("makes a parenthesized abbreviation a synonym of the preceding concept", () => {
    expect(conceptItem("Next.js ile sunucu tarafı render (SSR) deneyimi")).toEqual([
      { term: "Next.js", synonyms: [] },
      { term: "sunucu tarafı render", synonyms: ["SSR"] },
    ])
    expect(conceptItem("Web performansı ve erişilebilirlik (WCAG) konusunda bilgi")).toEqual([
      { term: "Web performansı", synonyms: [] },
      { term: "erişilebilirlik", synonyms: ["WCAG"] },
    ])
  })

  it("distributes a common head and makes a parenthesized example list a separate option concept", () => {
    // Örnekler eş anlamlı değil: yalnızca Jest bilen aday entegrasyon
    // testini karşılamış sayılmamalı.
    expect(conceptItem("Birim ve entegrasyon testleri (Jest, Playwright veya Cypress)")).toEqual([
      { term: "Birim testleri", synonyms: [] },
      { term: "entegrasyon testleri", synonyms: [] },
      { term: "Jest / Playwright / Cypress", synonyms: ["Jest", "Playwright", "Cypress"] },
    ])
  })

  it("drops auxiliary verbs and fillers like 'hakimiyet'", () => {
    expect(termList("GraphQL ile çalışmış olmak")).toEqual(["GraphQL"])
    expect(conceptItem("CI/CD süreçlerine (GitHub Actions) hakimiyet")).toEqual([
      { term: "CI/CD", synonyms: ["GitHub Actions"] },
    ])
    expect(termList("Takım içinde mentorluk ve kod incelemesi deneyimi")).toEqual([
      "mentorluk", "kod incelemesi",
    ])
  })

  it("drops a leading level phrase even with a capital İ", () => {
    expect(termList("İyi derecede İngilizce")).toEqual(["İngilizce"])
  })

  it("turns a 'veya' list into a single option concept", () => {
    expect(conceptItem("Fintech veya ödeme sistemleri deneyimi")).toEqual([
      { term: "Fintech / ödeme sistemleri", synonyms: ["Fintech", "ödeme sistemleri"] },
    ])
  })

  it("drops a trailing task noun", () => {
    expect(termList("Storybook ile tasarım sistemi geliştirme")).toEqual([
      "Storybook", "tasarım sistemi",
    ])
  })

  it("extracts the brand from a compound and the term from a comitative suffix", () => {
    expect(
      termList("Google Ads, Meta Ads ve TikTok Ads kampanyalarının kurulumu ve optimizasyonu"),
    ).toEqual(["Google Ads", "Meta Ads", "TikTok Ads"])
    expect(termList("Bütçe yönetimi ve ROAS hedefleriyle çalışma deneyimi")).toEqual([
      "Bütçe yönetimi", "ROAS",
    ])
  })

  it("separates two tasks joined by a gerund and turns the infinitive into a noun", () => {
    expect(termList("A/B testleri tasarlayıp sonuçlarını raporlamak")).toEqual([
      "A/B testleri", "raporlama",
    ])
  })

  it("separates the option list before 'ile' and the task after it", () => {
    expect(termList("SQL veya Looker Studio ile veri analizi yapabilmek")).toEqual([
      "SQL / Looker Studio", "veri analizi",
    ])
  })

  it("does not mistake 'takip' and 'sahip' for gerunds", () => {
    expect(termList("Jira ile proje takip deneyimi")).toEqual(["Jira", "proje takip"])
  })

  it("turns a general education requirement into a degree concept", () => {
    const [k] = conceptItem("Üniversitelerin ilgili bölümlerinden mezun", "education")
    expect(k!.term).toBe("Üniversite mezunu")
    expect(k!.synonyms).toContain("lisans")
  })

  it("does not generalize an education requirement with a stated field", () => {
    expect(termList("Bilgisayar Mühendisliği mezunu")).not.toContain("Üniversite mezunu")
    expect(
      conceptItem("Bilgisayar Mühendisliği bölümünden mezun", "education")[0]!.term,
    ).not.toBe("Üniversite mezunu")
  })
})
