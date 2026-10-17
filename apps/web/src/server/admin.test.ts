import { describe, expect, it } from "vitest"
import { isAdmin } from "@/server/admin"

describe("isAdmin", () => {
  const list = "Biri@Ornek.com, iki@ornek.com"

  it("matches listed registered accounts case-insensitively", () => {
    expect(isAdmin({ email: "biri@ornek.com", isAnonymous: false }, list)).toBe(true)
    expect(isAdmin({ email: " IKI@ornek.com " }, list)).toBe(true)
  })

  it("never treats anonymous, unlisted or email-less users as admin", () => {
    expect(isAdmin({ email: "biri@ornek.com", isAnonymous: true }, list)).toBe(false)
    expect(isAdmin({ email: "uc@ornek.com" }, list)).toBe(false)
    expect(isAdmin({ isAnonymous: false }, list)).toBe(false)
    expect(isAdmin(null, list)).toBe(false)
  })

  it("is closed by default when the list is empty", () => {
    expect(isAdmin({ email: "biri@ornek.com" }, "")).toBe(false)
    expect(isAdmin({ email: "biri@ornek.com" }, undefined)).toBe(false)
  })
})
