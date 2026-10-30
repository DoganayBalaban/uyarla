import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"
import { ICON_PATH, ICON_VIEWBOX, LOGO_PATH, LOGO_VIEWBOX, brandSvg } from "./brand.js"

describe("brand (DOG-169)", () => {
  it("uses the same mark and logo as the site", () => {
    // Web'in UyarlaMark'ı asıl kaynak; eklenti paketine ayrı kopya giriyor.
    const web = readFileSync(resolve(process.cwd(), "../web/src/components/brand/UyarlaMark.tsx"), "utf8")
    for (const value of [ICON_VIEWBOX, ICON_PATH, LOGO_VIEWBOX, LOGO_PATH]) expect(web).toContain(`"${value}"`)
  })

  it("draws the mark as an inline svg in the text color", () => {
    const doc = new JSDOM("<!doctype html><body></body>").window.document
    const svg = brandSvg(doc, "icon")
    expect(svg.getAttribute("viewBox")).toBe(ICON_VIEWBOX)
    expect(svg.getAttribute("fill")).toBe("currentColor")
    expect(svg.querySelector("path")?.getAttribute("d")).toBe(ICON_PATH)
  })

  it("shows the logo in the popup header", () => {
    const popup = readFileSync(resolve(process.cwd(), "popup.html"), "utf8")
    expect(popup).toContain(LOGO_PATH)
    expect(popup).not.toContain('class="mark"')
  })
})
