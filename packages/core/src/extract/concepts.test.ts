import { describe, it, expect } from "vitest"
import { splitIntoConcepts } from "./concepts.js"

const terimler = (metin: string) => splitIntoConcepts(metin).map((c) => c.term)

describe("splitIntoConcepts · gerçek ilanlardan", () => {
  it("virgül ve 've' ile ayrılmış bileşik gereksinimi böler", () => {
    expect(terimler("Python, REST API, SQL ve NoSQL veri tabanları konusunda deneyim")).toEqual([
      "Python", "REST API", "SQL", "NoSQL veri tabanları",
    ])
  })

  it("beş bileşenli gereksinimi eksiksiz böler", () => {
    // Model bu gereksinimde yalnızca 1 kavram çıkarıyordu.
    expect(
      terimler("Generative AI Yetkinlikleri, OpenAI, Azure OpenAI, Anthropic Claude ve Gemini API"),
    ).toEqual(["Generative AI", "OpenAI", "Azure OpenAI", "Anthropic Claude", "Gemini API"])
  })

  it("CI/CD'yi ikiye bölmez", () => {
    expect(terimler("Git ve CI/CD deneyimi")).toEqual(["Git", "CI/CD"])
  })

  it("iki nokta üst üsteden sonraki listeyi de böler", () => {
    expect(
      terimler("4+ years of production software engineering: APIs, services, testing, CI/CD"),
    ).toEqual(["production software engineering", "APIs", "services", "testing", "CI/CD"])
  })

  it("baştaki süre ifadesini atar", () => {
    expect(terimler("En az 3 yıl React deneyimi")).toEqual(["React"])
    expect(terimler("At least 2 years of Kubernetes experience")).toEqual(["Kubernetes"])
  })

  it("İngilizce dolgu kalıplarını atar, 'or' listesini seçenek sayar", () => {
    const [kavram, ...fazla] = splitIntoConcepts(
      "Hands on with LangChain, LangGraph, or equivalent agent frameworks",
    )
    expect(fazla).toHaveLength(0)
    expect(kavram!.term).toBe("LangChain / LangGraph / agent")
    expect(kavram!.synonyms).toEqual(["LangChain", "LangGraph", "agent"])
  })

  it("'ile' araç ve işi ayrı kavram yapar, sondaki dolguyu atar", () => {
    expect(terimler("Kubernetes ile konteyner yönetimi zorunludur")).toEqual([
      "Kubernetes", "konteyner yönetimi",
    ])
  })

  it("kavram çıkmayan gereksinimde metnin tamamını tek kavram sayar", () => {
    // "5 yıl deneyim" gibi gereksinimlerde aranacak somut bir terim yok;
    // skorlamanın yine de en az bir kavrama ihtiyacı var.
    const k = terimler("Benzer bir işte en az 5 yıl deneyim sahibi olmak")
    expect(k).toHaveLength(1)
    expect(k[0]).toContain("5 yıl")
  })

  it("aynı terimi iki kez döndürmez", () => {
    expect(terimler("Docker ve Docker Compose")).toEqual(["Docker", "Docker Compose"])
  })

  it("boş metinde tek kavram döner", () => {
    expect(splitIntoConcepts("   ")).toHaveLength(1)
  })
})

/**
 * Uçtan uca testte çöp kavram üreten gereksinimler (K-38). İki ilan: fintech
 * frontend ve e-ticaret performans pazarlama.
 */
describe("splitIntoConcepts · Türkçe yapılar", () => {
  const kavram = (metin: string, tur?: Parameters<typeof splitIntoConcepts>[1]) =>
    splitIntoConcepts(metin, tur)

  it("'ile'den sonraki süre ve dolgu kalıbını atar", () => {
    expect(terimler("React ve TypeScript ile en az 4 yıl profesyonel deneyim")).toEqual([
      "React", "TypeScript",
    ])
  })

  it("parantezdeki kısaltmayı önündeki kavramın eş anlamlısı yapar", () => {
    expect(kavram("Next.js ile sunucu tarafı render (SSR) deneyimi")).toEqual([
      { term: "Next.js", synonyms: [] },
      { term: "sunucu tarafı render", synonyms: ["SSR"] },
    ])
    expect(kavram("Web performansı ve erişilebilirlik (WCAG) konusunda bilgi")).toEqual([
      { term: "Web performansı", synonyms: [] },
      { term: "erişilebilirlik", synonyms: ["WCAG"] },
    ])
  })

  it("ortak başı dağıtır, parantezdeki örnek listesini ayrı seçenek kavramı yapar", () => {
    // Örnekler eş anlamlı değil: yalnızca Jest bilen aday entegrasyon
    // testini karşılamış sayılmamalı.
    expect(kavram("Birim ve entegrasyon testleri (Jest, Playwright veya Cypress)")).toEqual([
      { term: "Birim testleri", synonyms: [] },
      { term: "entegrasyon testleri", synonyms: [] },
      { term: "Jest / Playwright / Cypress", synonyms: ["Jest", "Playwright", "Cypress"] },
    ])
  })

  it("yardımcı fiilleri ve 'hakimiyet' gibi dolguları atar", () => {
    expect(terimler("GraphQL ile çalışmış olmak")).toEqual(["GraphQL"])
    expect(kavram("CI/CD süreçlerine (GitHub Actions) hakimiyet")).toEqual([
      { term: "CI/CD", synonyms: ["GitHub Actions"] },
    ])
    expect(terimler("Takım içinde mentorluk ve kod incelemesi deneyimi")).toEqual([
      "mentorluk", "kod incelemesi",
    ])
  })

  it("baştaki seviye ifadesini büyük İ ile de atar", () => {
    expect(terimler("İyi derecede İngilizce")).toEqual(["İngilizce"])
  })

  it("'veya' listesini tek seçenekli kavram yapar", () => {
    expect(kavram("Fintech veya ödeme sistemleri deneyimi")).toEqual([
      { term: "Fintech / ödeme sistemleri", synonyms: ["Fintech", "ödeme sistemleri"] },
    ])
  })

  it("sondaki iş adını atar", () => {
    expect(terimler("Storybook ile tasarım sistemi geliştirme")).toEqual([
      "Storybook", "tasarım sistemi",
    ])
  })

  it("tamlamadan marka adını, birliktelik ekinden terimi çıkarır", () => {
    expect(
      terimler("Google Ads, Meta Ads ve TikTok Ads kampanyalarının kurulumu ve optimizasyonu"),
    ).toEqual(["Google Ads", "Meta Ads", "TikTok Ads"])
    expect(terimler("Bütçe yönetimi ve ROAS hedefleriyle çalışma deneyimi")).toEqual([
      "Bütçe yönetimi", "ROAS",
    ])
  })

  it("ulaçla bağlanmış iki işi ayırır, mastarı ada çevirir", () => {
    expect(terimler("A/B testleri tasarlayıp sonuçlarını raporlamak")).toEqual([
      "A/B testleri", "raporlama",
    ])
  })

  it("'ile'den önceki seçenek listesini ve sonraki işi ayırır", () => {
    expect(terimler("SQL veya Looker Studio ile veri analizi yapabilmek")).toEqual([
      "SQL / Looker Studio", "veri analizi",
    ])
  })

  it("'takip' ve 'sahip' kelimelerini ulaç sanmaz", () => {
    expect(terimler("Jira ile proje takip deneyimi")).toEqual(["Jira", "proje takip"])
  })

  it("genel eğitim gereksinimini derece kavramına çevirir", () => {
    const [k] = kavram("Üniversitelerin ilgili bölümlerinden mezun", "education")
    expect(k!.term).toBe("Üniversite mezunu")
    expect(k!.synonyms).toContain("lisans")
  })

  it("alanı belirtilmiş eğitim gereksinimini genelleştirmez", () => {
    expect(terimler("Bilgisayar Mühendisliği mezunu")).not.toContain("Üniversite mezunu")
    expect(
      kavram("Bilgisayar Mühendisliği bölümünden mezun", "education")[0]!.term,
    ).not.toBe("Üniversite mezunu")
  })
})
