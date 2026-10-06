import { describe, expect, it } from "vitest"
import { profilePatchSchema } from "@/features/onboarding/schema"
import { firstIssue } from "@/lib/validation"

function errorOf(body: unknown): string | null {
  const parsed = profilePatchSchema.safeParse(body)
  return parsed.success ? null : firstIssue(parsed.error).message
}

describe("profilePatchSchema", () => {
  it("accepts any subset of fields and trims text", () => {
    expect(profilePatchSchema.parse({ name: "  Doğanay " }).name).toBe("Doğanay")
    expect(profilePatchSchema.parse({ goal: "first_job", targetRole: " Frontend " }).targetRole).toBe("Frontend")
    expect(errorOf({ completeOnboarding: true })).toBeNull()
  })

  it("lets goal and target role be cleared", () => {
    expect(profilePatchSchema.parse({ goal: null, targetRole: null })).toEqual({ goal: null, targetRole: null })
  })

  it("turns an empty target role into null", () => {
    expect(profilePatchSchema.parse({ targetRole: "   " }).targetRole).toBeNull()
  })

  it("rejects an empty name, unknown goal and long values in Turkish", () => {
    expect(errorOf({ name: "  " })).toBe("Adını yazar mısın?")
    expect(errorOf({ name: "x".repeat(61) })).toBe("Ad en fazla 60 karakter olabilir.")
    expect(errorOf({ goal: "rich" })).toBe("Geçersiz amaç.")
    expect(errorOf({ targetRole: "x".repeat(81) })).toBe("Hedef rol en fazla 80 karakter olabilir.")
  })

  it("rejects an empty patch", () => {
    expect(errorOf({})).toBe("Güncellenecek bir şey yok.")
  })
})
