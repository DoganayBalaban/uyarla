import { describe, expect, it } from "vitest"
import { withContact } from "./contact.js"

describe("withContact", () => {
  it("adds the account e-mail and phone when the CV line has neither", () => {
    expect(withContact("Frontend Geliştirici · İstanbul", { email: "elif@ornek.com", phone: "+90 555 000 00 00" })).toBe(
      "Frontend Geliştirici · İstanbul · elif@ornek.com · +90 555 000 00 00",
    )
  })

  it("keeps what the CV already has and does not duplicate it", () => {
    expect(withContact("İstanbul · elif@cv.com · 0555 111 22 33", { email: "elif@ornek.com", phone: "+90 555 000 00 00" })).toBe(
      "İstanbul · elif@cv.com · 0555 111 22 33",
    )
  })

  it("builds a line when the CV has none, and skips empty values", () => {
    expect(withContact(null, { email: "elif@ornek.com", phone: "" })).toBe("elif@ornek.com")
    expect(withContact(null, { email: null, phone: null })).toBeNull()
  })

  it("does not take a year range for a phone number", () => {
    expect(withContact("2016 - 2020", { email: null, phone: "0555 111 22 33" })).toBe("2016 - 2020 · 0555 111 22 33")
  })
})
