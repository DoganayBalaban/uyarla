import { describe, expect, it } from "vitest"
import { htmlToText as htmlToText, extractPostingText as extractPostingText, isAllowedPath as isAllowedPath } from "@/server/jobPostingFromUrl"

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

describe("htmlToText", () => {
  it("turns paragraphs and list items into lines and decodes entities", () => {
    const html =
      "<p>Aradığımız <strong>nitelikler</strong>:</p><ul><li>React &amp; TypeScript</li><li>3+ yıl</li></ul><script>x()</script><p>Ş&#305;k &#x130;stanbul&nbsp;ofis</p>"
    expect(htmlToText(html)).toBe("Aradığımız nitelikler:\n\n- React & TypeScript\n- 3+ yıl\nŞık İstanbul ofis")
  })
})

describe("extractPostingText", () => {
  const descriptionText = "<p>Frontend ekibimize katılacak bir geliştirici arıyoruz.</p><ul><li>React deneyimi</li><li>TypeScript</li><li>Birim testi yazma alışkanlığı</li></ul>"

  it("prefers JSON-LD JobPosting (also inside @graph)", () => {
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "X" },
        { "@type": "JobPosting", title: "Frontend Geliştirici", hiringOrganization: { name: "Acme" }, description: descriptionText },
      ],
    }
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><nav>Menü</nav></body></html>`
    const posting = extractPostingText(html)!
    expect(posting.source).toBe("json-ld")
    expect(posting.position).toBe("Frontend Geliştirici")
    expect(posting.company).toBe("Acme")
    expect(posting.text.startsWith("Frontend Geliştirici — Acme\n\nFrontend ekibimize")).toBe(true)
    expect(posting.text).toContain("- React deneyimi")
    expect(posting.text).not.toContain("Menü")
  })

  it("falls back to main content without JSON-LD, dropping menu and footer", () => {
    const html = `<html><head><title>Veri Analisti | Beta</title></head><body><nav>Giriş Yap Kayıt Ol</nav><main><h1>Veri Analisti</h1>${descriptionText.repeat(2)}</main><footer>© Beta</footer></body></html>`
    const posting = extractPostingText(html)!
    expect(posting.source).toBe("sayfa")
    expect(posting.position).toBe("Veri Analisti | Beta")
    expect(posting.text.startsWith("Veri Analisti | Beta\n\n")).toBe(true)
    expect(posting.text).not.toContain("Giriş Yap")
    expect(posting.text).not.toContain("© Beta")
  })

  it("Kariyer.net: trims the posting between the title and the company/salary sections", () => {
    // Gerçek sayfanın yapısından sadeleştirildi (Eylül 2026).
    const html = `<html><head><title>Dija &amp; Co Sosyal Medya Uzmanı İş İlanı - 26.09.2026</title></head><body>
      <ol><li><a>Ana Sayfa</a></li><li><a>İş İlanları</a></li></ol>
      <h1>Sosyal Medya Uzmanı <a>Dija &amp; Co</a></h1><p>Kaydet Başvur</p><p>60 başvuru</p>
      <h2>İş İlanı Hakkında</h2>
      <p><strong>Görev ve Sorumluluklar</strong></p>
      <ul><li>Farklı markaların sosyal medya hesaplarının aktif olarak yönetilmesi</li><li>Aylık ve haftalık içerik planlarının hazırlanması</li></ul>
      <p><strong>Aranan Nitelikler</strong></p>
      <ul><li>Sosyal medya yönetimi konusunda deneyimli</li><li>Instagram, Facebook, LinkedIn ve TikTok platformlarına hakim</li></ul>
      <h3>İşverenlerin %98'i hemfikir: Prova yapan aday öne çıkıyor!</h3>
      <h3>Şirket Hakkında</h3><p>Dija &amp; Co yaratıcı bir ajans.</p>
      <h3>Bu Pozisyon İçin Sık Paylaşılan Maaşlar</h3><p>₺46.400-₺75.000</p>
    </body></html>`
    const posting = extractPostingText(html, "www.kariyer.net")!
    expect(posting.position).toBe("Dija & Co Sosyal Medya Uzmanı")
    expect(posting.text.startsWith("Dija & Co Sosyal Medya Uzmanı\n\nGörev ve Sorumluluklar")).toBe(true)
    expect(posting.text).toContain("- Instagram, Facebook, LinkedIn ve TikTok platformlarına hakim")
    for (const noise of ["Kaydet Başvur", "60 başvuru", "Prova", "yaratıcı bir ajans", "₺46.400"]) {
      expect(posting.text).not.toContain(noise)
    }
  })

  it("null without content (login wall, empty page)", () => {
    expect(extractPostingText("<html><body><main>Devam etmek için giriş yapın.</main></body></html>")).toBeNull()
  })

  it("skips invalid JSON-LD and falls back to the page", () => {
    const html = `<script type="application/ld+json">{bozuk</script><main>${descriptionText.repeat(3)}</main>`
    expect(extractPostingText(html)?.source).toBe("sayfa")
  })
})
