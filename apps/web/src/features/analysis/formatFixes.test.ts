import { describe, expect, it } from "vitest"
import { fixHint } from "@/features/analysis/formatFixes"

describe("fixHint", () => {
  it("says layout problems are fixed in the downloaded CV", () => {
    for (const code of ["table", "header_footer", "multiple_columns", "text_box", "image", "icon_characters", "column_hint"]) {
      expect(fixHint(code)?.kind).toBe("export")
    }
  })

  it("says contact gaps are filled from the account", () => {
    expect(fixHint("email_missing")?.kind).toBe("contact")
    expect(fixHint("email_in_header")?.kind).toBe("contact")
    expect(fixHint("phone_missing")).toMatchObject({ kind: "action", href: "/account" })
  })

  it("has no hint for content problems the user must fix", () => {
    expect(fixHint("dates_missing")).toBeNull()
    expect(fixHint("too_short")).toBeNull()
  })
})
