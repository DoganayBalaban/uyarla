import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendMagicLinkEmail } from "./mail"

const ORIJINAL = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env = { ...ORIJINAL }
})

describe("sendMagicLinkEmail", () => {
  it("RESEND_API_KEY yoksa bağlantıyı konsola yazar, hata fırlatmaz", async () => {
    // Hesap açmadan geliştirme yapılabilmesi bilinçli bir karar (spec §6).
    delete process.env.RESEND_API_KEY
    const log = vi.spyOn(console, "info").mockImplementation(() => {})

    await sendMagicLinkEmail({ email: "aday@ornek.com", url: "https://x/y?token=abc" })

    expect(log).toHaveBeenCalled()
    expect(log.mock.calls.flat().join(" ")).toContain("https://x/y?token=abc")
  })

  it("konsol modunda e-posta adresini de yazar", async () => {
    delete process.env.RESEND_API_KEY
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    await sendMagicLinkEmail({ email: "aday@ornek.com", url: "https://x" })
    expect(log.mock.calls.flat().join(" ")).toContain("aday@ornek.com")
  })

  it("anahtar varsa Resend'e gönderir", async () => {
    process.env.RESEND_API_KEY = "re_test"
    process.env.EMAIL_FROM = "Uyarla <merhaba@uyarla.app>"
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null })

    await sendMagicLinkEmail(
      { email: "aday@ornek.com", url: "https://x/y" },
      { emails: { send } },
    )

    expect(send).toHaveBeenCalledOnce()
    const cagri = send.mock.calls[0]![0]
    expect(cagri.to).toBe("aday@ornek.com")
    expect(cagri.from).toBe("Uyarla <merhaba@uyarla.app>")
    expect(cagri.html).toContain("https://x/y")
  })

  it("Resend hata dönerse fırlatır", async () => {
    // Sessizce yutmak, kullanıcıyı gelmeyecek bir e-postayı beklemeye iter.
    process.env.RESEND_API_KEY = "re_test"
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: "quota" } })

    await expect(
      sendMagicLinkEmail({ email: "a@b.c", url: "https://x" }, { emails: { send } }),
    ).rejects.toThrow(/quota/)
  })

  it("e-posta metni Türkçe ve marka tonunda", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null })
    await sendMagicLinkEmail({ email: "a@b.c", url: "https://x" }, { emails: { send } })

    const cagri = send.mock.calls[0]![0]
    expect(cagri.subject).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(cagri.html).not.toMatch(/click here|sign in/i)
  })
})
