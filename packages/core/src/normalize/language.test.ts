import { describe, expect, it } from "vitest"
import { detectLanguage } from "./language.js"

describe("detectLanguage", () => {
  it("Türkçe CV maddesini tanır", () => {
    expect(detectLanguage("React ve TypeScript ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azalttım.")).toBe("tr")
  })

  it("İngilizce CV maddesini tanır", () => {
    expect(detectLanguage("Rebuilt the seller dashboard with React and TypeScript, reducing page load time by 40%.")).toBe("en")
  })

  it("teknoloji adlarıyla dolu kısa İngilizce maddeyi de tanır", () => {
    expect(detectLanguage("Built the checkout flow with Next.js and GraphQL")).toBe("en")
  })

  it("içinde İngilizce terim geçen Türkçe maddeyi Türkçe sayar", () => {
    expect(detectLanguage("CI/CD pipeline ve unit test altyapısını kurdum")).toBe("tr")
  })

  it("belirsiz metinde Türkçeye düşer", () => {
    expect(detectLanguage("React, TypeScript")).toBe("tr")
  })
})
