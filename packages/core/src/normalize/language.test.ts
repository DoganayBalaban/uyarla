import { describe, expect, it } from "vitest"
import { detectLanguage } from "./language.js"

describe("detectLanguage", () => {
  it("recognizes a Turkish resume bullet", () => {
    expect(detectLanguage("React ve TypeScript ile satıcı panelini baştan yazdım; sayfa yüklenme süresini %40 azalttım.")).toBe("tr")
  })

  it("recognizes an English resume bullet", () => {
    expect(detectLanguage("Rebuilt the seller dashboard with React and TypeScript, reducing page load time by 40%.")).toBe("en")
  })

  it("also recognizes a short English bullet full of technology names", () => {
    expect(detectLanguage("Built the checkout flow with Next.js and GraphQL")).toBe("en")
  })

  it("treats a Turkish bullet containing English terms as Turkish", () => {
    expect(detectLanguage("CI/CD pipeline ve unit test altyapısını kurdum")).toBe("tr")
  })

  it("falls back to Turkish for ambiguous text", () => {
    expect(detectLanguage("React, TypeScript")).toBe("tr")
  })
})
