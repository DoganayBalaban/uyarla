import { describe, expect, it } from "vitest"
import { NOTE_MAX_LENGTH } from "@/features/applications/board"
import { applicationPatchSchema, noteFormSchema } from "@/features/applications/schema"
import { firstIssue } from "@/lib/validation"

function errorOf(body: unknown): string | null {
  const parsed = applicationPatchSchema.safeParse(body)
  return parsed.success ? null : firstIssue(parsed.error).message
}

describe("applicationPatchSchema", () => {
  it("accepts a stage, a note or both", () => {
    expect(errorOf({ stage: "interview" })).toBeNull()
    expect(errorOf({ note: "İK ile görüşüldü" })).toBeNull()
    expect(errorOf({ stage: "offer", note: null })).toBeNull()
  })

  it("trims the note so an empty note clears it", () => {
    expect(applicationPatchSchema.parse({ note: "   " }).note).toBe("")
  })

  it("rejects an unknown stage and a non-string note with the old messages", () => {
    expect(errorOf({ stage: "hired" })).toBe("Geçersiz aşama.")
    expect(errorOf({ note: 3 })).toBe("Geçersiz not.")
  })

  it("rejects a note over the limit", () => {
    expect(errorOf({ note: "x".repeat(NOTE_MAX_LENGTH + 1) })).toBe(
      `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.`,
    )
  })

  it("rejects an empty patch", () => {
    expect(errorOf({})).toBe("Güncellenecek bir şey yok.")
  })
})

describe("noteFormSchema", () => {
  it("shares the note rule with the API", () => {
    expect(noteFormSchema.safeParse({ note: "x".repeat(NOTE_MAX_LENGTH + 1) }).success).toBe(false)
    expect(noteFormSchema.parse({ note: "  not  " }).note).toBe("not")
  })
})
