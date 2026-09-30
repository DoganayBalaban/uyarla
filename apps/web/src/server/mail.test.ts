import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendMagicLinkEmail } from "@/server/mail"

const ORIGINAL = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("sendMagicLinkEmail", () => {
  it("logs the link to the console without RESEND_API_KEY and does not throw", async () => {
    // Hesap açmadan geliştirme yapılabilmesi bilinçli bir karar (spec §6).
    delete process.env.RESEND_API_KEY
    const log = vi.spyOn(console, "info").mockImplementation(() => {})

    await sendMagicLinkEmail({ email: "aday@ornek.com", url: "https://x/y?token=abc" })

    expect(log).toHaveBeenCalled()
    expect(log.mock.calls.flat().join(" ")).toContain("https://x/y?token=abc")
  })

  it("also logs the email address in console mode", async () => {
    delete process.env.RESEND_API_KEY
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    await sendMagicLinkEmail({ email: "aday@ornek.com", url: "https://x" })
    expect(log.mock.calls.flat().join(" ")).toContain("aday@ornek.com")
  })

  it("sends via Resend when the key is set", async () => {
    process.env.RESEND_API_KEY = "re_test"
    process.env.EMAIL_FROM = "Uyarla <merhaba@uyarla.app>"
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null })

    await sendMagicLinkEmail(
      { email: "aday@ornek.com", url: "https://x/y" },
      { emails: { send } },
    )

    expect(send).toHaveBeenCalledOnce()
    const call = send.mock.calls[0]![0]
    expect(call.to).toBe("aday@ornek.com")
    expect(call.from).toBe("Uyarla <merhaba@uyarla.app>")
    expect(call.html).toContain("https://x/y")
  })

  it("throws when Resend returns an error", async () => {
    // Sessizce yutmak, kullanıcıyı gelmeyecek bir e-postayı beklemeye iter.
    process.env.RESEND_API_KEY = "re_test"
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: "quota" } })

    await expect(
      sendMagicLinkEmail({ email: "a@b.c", url: "https://x" }, { emails: { send } }),
    ).rejects.toThrow(/quota/)
  })

  it("email text is Turkish and on brand", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null })
    await sendMagicLinkEmail({ email: "a@b.c", url: "https://x" }, { emails: { send } })

    const call = send.mock.calls[0]![0]
    expect(call.subject).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(call.html).not.toMatch(/click here|sign in/i)
  })
})
