import { existsSync } from "node:fs"
import { resolve } from "node:path"
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

  it("shows each way beside how it really looks on LinkedIn (DOG-169)", () => {
    // Kurucunun LinkedIn oturumundan, kişi ve şirket adları bulanıklaştırılmış; ayrı "ekran görüntüsü" bölümü yok.
    expect(html).not.toContain("ekran görüntü")
    expect(html).not.toContain("Gerçek ekran")
    // next/image adresi kodluyor: /_next/image?url=%2Flanding%2Feklenti%2Filan.webp&…
    const sources = new Set([...html.matchAll(/url=(%2Flanding%2Feklenti%2F[a-z]+\.webp)/g)].map((m) => decodeURIComponent(m[1]!)))
    expect([...sources].sort()).toEqual(["/landing/eklenti/ilan.webp", "/landing/eklenti/menu.webp", "/landing/eklenti/profil.webp"])
    for (const src of sources) expect(existsSync(resolve(__dirname, "../../../../public", `.${src}`)), src).toBe(true)
  })
})
