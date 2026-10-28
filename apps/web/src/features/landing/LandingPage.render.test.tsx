import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LandingPage } from "@/features/landing/LandingPage"

describe("LandingPage journey (DOG-160)", () => {
  const html = renderToStaticMarkup(<LandingPage />)

  it("has the rail and the six step sections", () => {
    expect(html).toContain('id="yolculuk"')
    for (const id of ["bul", "uyarla", "basvur", "takip", "hazirlan", "gorunur"]) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('href="#takip"')
  })

  it("labels access from the pricing table", () => {
    expect(html).toContain("İş arama")
    expect(html).toContain("Abonelikte")
    expect(html).toContain("Ayda 1 ücretsiz")
  })

  it("drops the three-step and bento blocks, keeps the adapt demos", () => {
    expect(html).not.toContain("Üç adım. Kayıt yok, kurulum yok.")
    expect(html).not.toContain("Başvur, uyarla, takip et.")
    expect(html).toContain("Olmayan bir deneyimi asla eklemez.")
  })
})
