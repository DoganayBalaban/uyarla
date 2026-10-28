import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const src = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8")

describe("yasal metinler abonelikle uyumlu (DOG-158)", () => {
  it("terms and refund explain renewal, cancelling and the trial", () => {
    for (const page of ["app/(marketing)/terms/page.tsx", "app/(marketing)/refund/page.tsx"]) {
      const s = src(page)
      expect(s).toContain("otomatik yenilenir")
      expect(s).toContain("7 gün")
      expect(s).not.toContain("otomatik yenileme yoktur")
      expect(s).not.toContain("1 hafta")
    }
    expect(src("app/(marketing)/terms/page.tsx")).toContain("6502")
  })

  it("privacy no longer speaks of one-time access periods", () => {
    expect(src("app/(marketing)/privacy/page.tsx")).not.toContain("erişim dönemi")
  })
})
