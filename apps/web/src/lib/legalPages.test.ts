import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { LEGAL } from "@/features/legal/company"

const page = (p: string) => readFileSync(join(__dirname, "../app/(marketing)", p, "page.tsx"), "utf8")

describe("legal pages (DOG-34)", () => {
  it("refund page explains the withdrawal exception and how to ask for a refund", () => {
    const text = page("refund")
    expect(text).toContain("cayma hakkı")
    expect(text).toContain("LEGAL.support")
  })

  it("privacy lists Polar as the payment processor", () => {
    expect(page("privacy")).toContain("Polar")
  })

  it("terms describe one-time passes without auto-renewal", () => {
    expect(page("terms")).toContain("otomatik yenileme")
  })

  it("separates KVKK requests from general support addresses", () => {
    expect(LEGAL.contact).toBe("kvkk@uyarla.com.tr")
    expect(LEGAL.support).toBe("iletisim@uyarla.com.tr")
    // Genel sorular iletisim@, KVKK başvuruları kvkk@ adresine.
    expect(page("terms")).toContain("LEGAL.support")
    expect(page("terms")).toContain("LEGAL.contact")
  })

  it("privacy explains how our mail is sent and received", () => {
    const text = page("privacy")
    expect(text).toContain("noreply@uyarla.com.tr")
    expect(text).toContain("Cloudflare Email Routing")
    expect(text).toContain("Google (ABD)")
  })
})
