import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const page = (p: string) => readFileSync(join(__dirname, "../app/(marketing)", p, "page.tsx"), "utf8")

describe("legal pages (DOG-34)", () => {
  it("refund page explains the withdrawal exception and how to ask for a refund", () => {
    const text = page("refund")
    expect(text).toContain("cayma hakkı")
    expect(text).toContain("iletisim@uyarla.com.tr")
  })

  it("privacy lists Polar as the payment processor", () => {
    expect(page("privacy")).toContain("Polar")
  })

  it("terms describe one-time passes without auto-renewal", () => {
    expect(page("terms")).toContain("otomatik yenileme")
  })
})
