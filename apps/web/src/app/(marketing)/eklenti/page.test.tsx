import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import ExtensionPage, { metadata } from "@/app/(marketing)/eklenti/page"

describe("/eklenti (DOG-163)", () => {
  const html = renderToStaticMarkup(<ExtensionPage />)

  it("introduces the three ways the extension works", () => {
    expect(metadata.title).toBe("Chrome eklentisi · uyarla")
    expect(html).toContain("uyarla&#x27;ya gönder")
    expect(html).toContain("Seçili metni uyarla ile ölç")
    expect(html).toContain("LinkedIn")
    expect(html).toContain("Kariyer.net")
  })

  it("is free, private by design and installs from the store", () => {
    expect(html).toContain("Ücretsiz")
    expect(html).toContain("Yalnızca simgeye bastığında")
    expect(html).toContain("Chrome&#x27;a ekle")
  })
})
