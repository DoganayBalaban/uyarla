import { describe, expect, it } from "vitest"
import { loginSchema } from "@/features/auth/schema"
import { firstIssue } from "@/lib/validation"

describe("loginSchema", () => {
  it("trims a valid address", () => {
    expect(loginSchema.parse({ email: "  aday@ornek.com " }).email).toBe("aday@ornek.com")
  })

  it("asks for the address when empty and flags a malformed one", () => {
    for (const [email, expected] of [
      ["", "E-posta adresini yazar mısın?"],
      ["aday@", "Bu e-posta adresi eksik görünüyor. Bir kontrol eder misin?"],
    ] as const) {
      const parsed = loginSchema.safeParse({ email })
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(firstIssue(parsed.error).message).toBe(expected)
    }
  })
})
