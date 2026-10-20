import { describe, expect, it } from "vitest"
import { canonicalPostingUrl, isAllowedPath, isLoginPath, looksLikeLoginWall } from "@/server/jobPostingFromUrl"

describe("isAllowedPath", () => {
  it.each([
    "https://www.kariyer.net/is-ilani/acme-frontend-gelistirici-123",
    "https://tr.linkedin.com/jobs/view/4012345678",
    "http://boards.greenhouse.io/acme/jobs/1",
    "https://acme.wd3.myworkdayjobs.com/tr-TR/External/job/1",
  ])("accepts %s (upgraded to https)", (address) => {
    const url = isAllowedPath(address)
    expect(url).not.toBeNull()
    expect(url!.protocol).toBe("https:")
  })

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "https://kariyer.net.kotu.site/ilan",
    "https://kotukariyer.net/ilan",
    "https://user:pass@www.kariyer.net/ilan",
    "https://www.kariyer.net:8080/ilan",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "düz metin",
  ])("rejects %s", (address) => {
    expect(isAllowedPath(address)).toBeNull()
  })
})

describe("LinkedIn login wall", () => {
  const LOGIN_PAGE = `LinkedIn Oturum Açma, Kayıt Olma | LinkedIn

Oturum açın

Apple ile oturum açın

Devam Et seçeneğini tıklayarak, LinkedIn Kullanıcı Anlaşmasını, Gizlilik Politikasını, ve Çerez Politikasını kabul etmiş olursunuz.`

  it("turns list and search links into the public job page", () => {
    const view = "https://www.linkedin.com/jobs/view/4453431016"
    expect(canonicalPostingUrl(new URL("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4453431016")).toString()).toBe(view)
    expect(canonicalPostingUrl(new URL("https://tr.linkedin.com/jobs/search/?currentJobId=4453431016&keywords=x")).toString()).toBe(view)
    expect(canonicalPostingUrl(new URL("https://tr.linkedin.com/jobs/view/senior-front-end-developer-at-agito-4453431016?trk=abc")).toString()).toBe(view)
    expect(canonicalPostingUrl(new URL("https://www.linkedin.com/feed/")).toString()).toBe("https://www.linkedin.com/feed/")
    expect(canonicalPostingUrl(new URL("https://www.kariyer.net/is-ilani/x-123?currentJobId=4453431016")).hostname).toBe("www.kariyer.net")
  })

  it("recognises redirects to a login page", () => {
    expect(isLoginPath(new URL("https://www.linkedin.com/uas/login?session_redirect=x"))).toBe(true)
    expect(isLoginPath(new URL("https://www.linkedin.com/authwall?trk=x"))).toBe(true)
    expect(isLoginPath(new URL("https://www.linkedin.com/jobs/view/4453431016"))).toBe(false)
  })

  it("recognises the login screen text, not a long posting that mentions logging in", () => {
    expect(looksLikeLoginWall({ text: LOGIN_PAGE, position: "LinkedIn Oturum Açma, Kayıt Olma | LinkedIn" })).toBe(true)
    expect(looksLikeLoginWall({ text: "Sign in to view more jobs", position: null })).toBe(true)
    const posting = `Login Experience Engineer — Acme\n\n${"Kimlik doğrulama akışlarını geliştireceksin. ".repeat(60)}`
    expect(looksLikeLoginWall({ text: posting, position: "Login Experience Engineer" })).toBe(false)
    expect(looksLikeLoginWall({ text: "Frontend Geliştirici — Acme\n\nReact deneyimi", position: "Frontend Geliştirici" })).toBe(false)
  })
})
