import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { EXTENSION_ACTION_TITLE, EXTENSION_MENU_TITLE, EXTENSION_PAGE_BUTTON, EXTENSION_PROFILE_BUTTON, storeHref } from "@/features/landing/extension"

const EXT = resolve(__dirname, "../../../../extension")

describe("extension copy (DOG-163)", () => {
  it("uses the extension's own button and menu titles", () => {
    const manifest = JSON.parse(readFileSync(resolve(EXT, "manifest.json"), "utf8")) as { action: { default_title: string } }
    expect(EXTENSION_ACTION_TITLE).toBe(manifest.action.default_title)
    expect(readFileSync(resolve(EXT, "src/background.ts"), "utf8")).toContain(`title: "${EXTENSION_MENU_TITLE}"`)
  })

  it("uses the page buttons' own labels (DOG-169)", () => {
    const content = readFileSync(resolve(EXT, "src/content.ts"), "utf8")
    expect(content).toContain(`label: "${EXTENSION_PAGE_BUTTON}"`)
    expect(content).toContain(`label: "${EXTENSION_PROFILE_BUTTON}"`)
  })

  it("links to the store once it is set, nowhere before", () => {
    expect(storeHref(null)).toBe("#")
    expect(storeHref("https://chromewebstore.google.com/detail/x")).toBe("https://chromewebstore.google.com/detail/x")
  })
})
