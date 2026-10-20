import { describe, expect, it } from "vitest"
import {
  accessEndingEmail,
  accessOpenedEmail,
  accountDeletedEmail,
  activationNoAnalysisEmail,
  applicationRemindersEmail,
} from "@/server/email/templates"

const followup = { position: "Muhasebe <Uzmanı>", company: "Atlas & Co", appliedAt: new Date("2026-10-10T09:00:00Z") }
const interview = { position: "Finans Uzmanı", company: "Beta", interviewAt: "2026-10-21", adaptationId: "ad-1" }
const deadline = { position: "Bütçe Uzmanı", company: null, deadline: "2026-10-22", adaptationId: "ad-2" }

describe("applicationRemindersEmail (DOG-98, DOG-128)", () => {
  it("escapes user text and keeps the follow-up wording", () => {
    const { html, text, subject } = applicationRemindersEmail({ followups: [followup], interviews: [], deadlines: [] })
    expect(subject).toBe("Başvurularından haber var mı?")
    expect(html).toContain("Muhasebe &lt;Uzmanı&gt;")
    expect(html).toContain("Atlas &amp; Co")
    expect(html).not.toContain("<Uzmanı>")
    expect(html).toContain("/account")
    expect(text).toContain("Muhasebe <Uzmanı> · Atlas & Co")
    expect(text).toContain("/applications")
  })

  it("leads with tomorrow's interview and links the adapted CV when it is the only item", () => {
    const { subject, html } = applicationRemindersEmail({ followups: [], interviews: [interview], deadlines: [] })
    expect(subject).toBe("Yarın Beta mülakatın var")
    expect(html).toContain("/adapt/ad-1")
    expect(html).toContain("Uyarladığın CV")
  })

  it("puts several kinds under their own headings and links the board", () => {
    const { subject, html, text } = applicationRemindersEmail({ followups: [followup], interviews: [interview], deadlines: [deadline] })
    expect(subject).toBe("Yarın Beta mülakatın var")
    expect(html).toContain("Son başvuru günü yaklaşanlar")
    expect(html).toContain("Bir haftadır ses çıkmayanlar")
    expect(html).toContain("/applications")
    expect(text).toContain("Son gün 22 Ekim".replace("Son gün", "son gün"))
  })

  it("uses the signed one-click link when there is one", () => {
    const { html } = applicationRemindersEmail({ followups: [followup], interviews: [], deadlines: [] }, "https://uyarla.com.tr/e-posta/cik?t=abc")
    expect(html).toContain("/e-posta/cik?t=abc")
    expect(html).toContain("tek tıkla kapatabilirsin")
  })
})

describe("access and account e-mails (DOG-129)", () => {
  it("says the pass does not renew, without sales pressure", () => {
    const { subject, text } = accessEndingEmail(new Date("2026-10-22T12:00:00Z"))
    expect(subject).toBe("Erişim dönemin 22 Ekim tarihinde bitiyor")
    expect(text).toContain("otomatik yenilenmiyor")
    expect(text.toLocaleLowerCase("tr")).not.toMatch(/son şans|kaçırma|indirim/)
  })

  it("confirms access with its end date and the deletion with Polar's retention", () => {
    expect(accessOpenedEmail(new Date("2026-11-20T12:00:00Z")).text).toContain("20 Kasım")
    expect(accountDeletedEmail().text).toContain("Polar fatura kaydını")
  })
})

describe("activation e-mails (DOG-130)", () => {
  it("names the consent in the footer", () => {
    expect(activationNoAnalysisEmail().html).toContain("ürün haberlerine onay verdiğin için")
  })
})
