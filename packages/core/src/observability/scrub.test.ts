import { describe, expect, it } from "vitest"
import { scrubErrorEvent } from "./scrub.js"

describe("scrubErrorEvent", () => {
  it("drops request body, cookies, query and sensitive headers", () => {
    const event = scrubErrorEvent({
      message: "hata",
      request: {
        url: "https://uyarla.app/api/analyze",
        method: "POST",
        data: "CV metni: Ayşe Yılmaz, 0555 ...",
        cookies: { "better-auth.session_token": "gizli" },
        query_string: "email=a@b.com",
        headers: { cookie: "x", authorization: "Bearer y", "user-agent": "Safari" },
      },
    })
    expect(event.request).toEqual({
      url: "https://uyarla.app/api/analyze",
      method: "POST",
      headers: { "user-agent": "Safari" },
    })
  })

  it("keeps only the user id", () => {
    const event = scrubErrorEvent({ user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4", username: "ayse" } })
    expect(event.user).toEqual({ id: "u1" })
  })

  it("masks email addresses and phone numbers in the message and exception values", () => {
    const event = scrubErrorEvent({
      message: "Gönderilemedi: ayse.yilmaz@ornek.com",
      exception: { values: [{ type: "Error", value: "Telefon +90 555 123 45 67 geçersiz" }] },
    })
    expect(event.message).toBe("Gönderilemedi: [e-posta]")
    expect(event.exception!.values![0]!.value).toBe("Telefon [telefon] geçersiz")
  })

  it("leaves an event without personal data untouched", () => {
    const event = { message: "Redis bağlantısı koptu", level: "error" }
    expect(scrubErrorEvent({ ...event })).toEqual(event)
  })
})
