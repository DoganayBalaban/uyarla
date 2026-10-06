import { describe, expect, it } from "vitest"
import { resumePatchSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"

function errorOf(body: unknown): string | null {
  const parsed = resumePatchSchema.safeParse(body)
  return parsed.success ? null : firstIssue(parsed.error).message
}

describe("resumePatchSchema", () => {
  it("accepts a label, making default, or both", () => {
    expect(resumePatchSchema.parse({ label: " Frontend CV " }).label).toBe("Frontend CV")
    expect(errorOf({ isDefault: true })).toBeNull()
  })

  it("turns an empty label into null so the file name shows", () => {
    expect(resumePatchSchema.parse({ label: "  " }).label).toBeNull()
  })

  it("does not accept isDefault false (default moves by picking another)", () => {
    expect(errorOf({ isDefault: false })).not.toBeNull()
  })

  it("rejects a long label and an empty patch", () => {
    expect(errorOf({ label: "x".repeat(61) })).toBe("CV adı en fazla 60 karakter olabilir.")
    expect(errorOf({})).toBe("Güncellenecek bir şey yok.")
  })
})
