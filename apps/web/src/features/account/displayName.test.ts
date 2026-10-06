import { describe, expect, it } from "vitest"
import { displayName } from "@/features/account/displayName"

describe("displayName", () => {
  it("shows the name when there is one", () => {
    expect(displayName({ name: "  Doğanay Balaban ", email: "d@ornek.com" })).toBe("Doğanay Balaban")
  })

  it("falls back to the e-mail for an empty name or one that is an address", () => {
    expect(displayName({ name: "", email: "d@ornek.com" })).toBe("d@ornek.com")
    expect(displayName({ name: null, email: "d@ornek.com" })).toBe("d@ornek.com")
    expect(displayName({ name: "d@ornek.com", email: "d@ornek.com" })).toBe("d@ornek.com")
  })
})
