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

  it("İngilizce dolgu kalıplarını atar", () => {
    expect(terimler("Hands on with LangChain, LangGraph, or equivalent agent frameworks")).toEqual([
      "LangChain", "LangGraph", "agent",
    ])
  })

  it("tek kavramlı gereksinimi bozmaz", () => {
    expect(terimler("Kubernetes ile konteyner yönetimi zorunludur")).toHaveLength(1)
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
