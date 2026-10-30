import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import ExtensionPage, { metadata } from "@/app/(marketing)/eklenti/page"

describe("/eklenti (DOG-163)", () => {
  const html = renderToStaticMarkup(<ExtensionPage />)

  it("introduces the three ways the extension works", () => {
    expect(metadata.title).toBe("Chrome eklentisi · uyarla")
    // DOG-169: ilanın yanındaki düğme, profil düğmesi ve simge menüsü.
    expect(html).toContain("CV&#x27;mi bu ilana uyarla")
    expect(html).toContain("Profilimi uyarla ile denetle")
    expect(html).toContain("Seçili metni uyarla ile ölç")
    expect(html).toContain("LinkedIn")
    expect(html).toContain("Kariyer.net")
  })

  it("is free, private by design and installs from the store", () => {
    expect(html).toContain("Ücretsiz")
    // Eklenti iş sitelerinde düğme için sayfaya bakıyor; "yalnızca simgeye bastığında okur" artık doğru değil.
    expect(html).toContain("Sen basmadan hiçbir şey göndermez")
    expect(html).not.toContain("Yalnızca simgeye bastığında")
    expect(html).toContain("Chrome&#x27;a ekle")
  })
})
