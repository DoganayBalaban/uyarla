import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { LANDING_FAQ } from "@/features/landing/faq"

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8")

describe("landing pricing (DOG-84)", () => {
  it("answers whether adaptation is paid, without hiding the free one", () => {
    const answer = LANDING_FAQ.find((q) => q.s === "Uyarlama ücretli mi?")?.c ?? ""
    expect(answer).toContain("İlk uyarlaman ücretsiz")
    expect(answer).toContain("otomatik yenileme yok")
  })

  it("has a pricing section that menus link to", () => {
    expect(src("features/landing/components/Pricing.tsx")).toContain('id="fiyat"')
    expect(src("features/landing/LandingPage.tsx")).toContain("<Pricing plans={plans} />")
    expect(src("components/layout/Navbar.tsx")).toContain('"/#fiyat"')
  })

  it("reads prices from the same plans as the plans screen", () => {
    // Fiyat iki yerde ayrı yazılmasın: ana sayfa da plansFromEnv'den okuyor.
    expect(src("app/(marketing)/page.tsx")).toContain("plansFromEnv(process.env)")
  })
})
