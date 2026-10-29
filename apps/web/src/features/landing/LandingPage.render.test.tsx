import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LandingPage } from "@/features/landing/LandingPage"
import { MARKETING_LINKS } from "@/components/layout/marketingLinks"

describe("LandingPage journey (DOG-160)", () => {
  const html = renderToStaticMarkup(<LandingPage />)

  it("has the rail and the six step sections", () => {
    expect(html).toContain('id="yolculuk"')
    for (const id of ["bul", "uyarla", "basvur", "takip", "hazirlan", "gorunur"]) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('href="#takip"')
  })

  it("shows no access chips; the pricing table carries free vs paid (29 Ekim)", () => {
    expect(html).not.toContain('aria-label="Erişim"')
    expect(html).not.toContain("Ön yazı · Ayda 1 ücretsiz")
    expect(html).not.toContain("Chrome eklentisi · Ücretsiz")
  })

  it("drops the three-step and bento blocks, keeps the adapt demos", () => {
    expect(html).not.toContain("Üç adım. Kayıt yok, kurulum yok.")
    expect(html).not.toContain("Başvur, uyarla, takip et.")
    expect(html).toContain("Olmayan bir deneyimi asla eklemez.")
  })

  it("tells the whole journey up top and answers the new questions (DOG-160)", () => {
    expect(html).toContain("Mülakat hazırlığı ve LinkedIn denetimi")
    expect(html).toContain("başvur, takip et, mülakata hazırlan")
    expect(html).toContain("Başvuru formlarını siz mi dolduruyorsunuz?")
    expect(html).toContain("Mülakat hazırlığında sorular nereden geliyor?")
    expect(html).toContain("LinkedIn profilimi nasıl denetliyorsunuz?")
    expect(html).toContain("Gönderimi sen yaparsın")
  })

  it("does not overclaim interview evidence in the FAQ (son inceleme)", () => {
    expect(html).not.toContain("Her sorunun yanında")
  })

  it("gives every navbar link a target that is not the sticky rail (DOG-161)", () => {
    // Üst menü hedefin sayfadaki yerini ölçüyor; yapışkan öğe hep tepede durduğu için vurgu karışıyordu.
    const withPlans = renderToStaticMarkup(<LandingPage plans={[{ key: "month", months: 1, productId: "p", priceTry: 299 }]} />)
    for (const { href } of MARKETING_LINKS) expect(withPlans, href).toContain(`id="${href.slice(2)}"`)
    expect(html).not.toMatch(/<nav[^>]*id="yolculuk"/)
    expect(MARKETING_LINKS).toContainEqual({ href: "/#gorunur", label: "LinkedIn" })
    expect(MARKETING_LINKS).toContainEqual({ href: "/#eklenti", label: "Eklenti" })
    expect(MARKETING_LINKS.map((l) => l.label)).not.toContain("Özellikler")
    expect(html).toContain("LinkedIn denetimi")
  })

  it("has an extension section that links to its page and the store (DOG-163)", () => {
    expect(html).toContain('id="eklenti"')
    expect(html).toContain("Chrome&#x27;a ekle")
    expect(html).toContain('href="/eklenti"')
    expect(html).not.toMatch(/[Ee]klenti[^<]{0,40}[Yy]akında/)
  })
})
