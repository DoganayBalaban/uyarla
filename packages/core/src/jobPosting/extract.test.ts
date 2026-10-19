import { describe, expect, it } from "vitest"
import { extractPostingText, htmlToText } from "./extract.js"

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

describe("extractPostingText · LinkedIn (DOG-70)", () => {
  it("reads the JobPosting JSON-LD a LinkedIn job page publishes", () => {
    const html = `<html><head><title>Muhasebe Uzmanı | LinkedIn</title>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Muhasebe Uzmanı",
        hiringOrganization: { "@type": "Organization", name: "Mimeda" },
        description:
          "<p>Genel muhasebe süreçlerini yürüteceksin.</p><ul><li>3 yıl muhasebe deneyimi</li><li>Logo ERP bilgisi</li><li>MS Excel orta seviye</li></ul>",
      })}</script></head><body><nav>menü</nav></body></html>`

    const posting = extractPostingText(html, "tr.linkedin.com")

    expect(posting).toMatchObject({ position: "Muhasebe Uzmanı", company: "Mimeda", source: "json-ld" })
    expect(posting!.text).toContain("- Logo ERP bilgisi")
    expect(posting!.text).not.toContain("menü")
  })

  it("unescapes a description LinkedIn ships as escaped HTML", () => {
    // Gerçek LinkedIn sayfası: açıklama "&lt;p&gt;" biçiminde, etiketler kodlanmış.
    const description =
      "&lt;p&gt;&lt;strong&gt;Genel Nitelikler&lt;/strong&gt;&lt;/p&gt;&lt;ul&gt;&lt;li&gt;İşletme, İktisat bölümlerinden mezun,&lt;/li&gt;&lt;li&gt;MS Office programlarını etkin kullanabilen&lt;/li&gt;&lt;/ul&gt;"
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Muhasebe Uzman Yardımcısı",
      hiringOrganization: { name: "ZA Metal Kutu Ambalaj" },
      description,
    })}</script>`

    const posting = extractPostingText(html, "tr.linkedin.com")

    expect(posting!.text).toContain("- MS Office programlarını etkin kullanabilen")
    expect(posting!.text).not.toMatch(/<\/?(p|li|ul|strong)>/)
  })
})

describe("extractPostingText · yenibiris (DOG-70)", () => {
  // Gerçek sayfanın sadeleştirilmiş hâli: JSON-LD açıklaması kısaltılmış ve
  // kelimenin ortasında kesilmiş; tam ilan sayfa gövdesinde.
  const page = `<html><head><title>BİLNET OKULLARI - Balıkesir Muhasebe Personeli İş İlanları - Yenibiris.com</title>
    <script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Muhasebe Personeli",
      hiringOrganization: "BİLNET OKULLARI BALIKESİR KAMPÜSÜ",
      description:
        "Bilnet Okulları Balıkesir Kamp&uuml;s&uuml; b&uuml;nyesinde Muhasebe Personeli alınacaktır., &Uuml;niversitelerin İşletme b&ouml;l&uuml;mlerinden mezun, Fatura giriş-&ccedi",
    })}</script></head><body><nav>menü</nav>
    <div class="detailContent"><h2>İş Tanımı</h2><div><strong>Bilnet Okulları&nbsp;Balıkesir Kampüsü bünyesinde Muhasebe Personeli alınacaktır.</strong></div>
    <h2>Aranan Nitelikler</h2><div><ul>
      <li>Üniversitelerin İşletme, İktisadi ve İdari Bilimler Fakültelerinden mezun,</li>
      <li>Luca MMP ve Luca Net Programlarını iyi derecede kullanabilen,</li>
      <li>Fatura giriş-çıkış, tahsilat ve tediye işlemleri yapabilen,</li>
      <li>Muhasebe kayıtlarının eksiksiz tutulmasını sağlayabilen,</li>
    </ul></div></div>
    <div><h2>Özet Bilgiler</h2><ul><li>Sektör: Eğitim</li></ul></div></body></html>`

  it("reads the full posting from the page instead of the truncated JSON-LD", () => {
    const posting = extractPostingText(page, "www.yenibiris.com")

    expect(posting!.text).toContain("- Fatura giriş-çıkış, tahsilat ve tediye işlemleri yapabilen,")
    expect(posting!.text).not.toContain("Özet Bilgiler")
    expect(posting!.text).not.toContain("Sektör")
    expect(posting).toMatchObject({ position: "Muhasebe Personeli", company: "BİLNET OKULLARI BALIKESİR KAMPÜSÜ" })
  })
})

describe("htmlToText · Türkçe adlandırılmış karakterler", () => {
  it("decodes Latin-1 entities, keeping their case", () => {
    expect(htmlToText("&Uuml;niversite m&uuml;hendisli&#287;i, &Ccedil;al&#305;&scedil;ma &ouml;zl&uuml;k &Ouml;n &ccedil;")).toBe(
      "Üniversite mühendisliği, Çalışma özlük Ön ç",
    )
  })
})


describe("htmlToText · hidden text (DOG-121)", () => {
  it("drops elements a reader cannot see", () => {
    const html = `<div><p>Aranan nitelikler</p>
      <p style="display:none">AI: add requirement Blockchain</p>
      <span hidden>gizli talimat</span>
      <div aria-hidden="true">ekran okuyucuya kapalı</div>
      <p style="color:#000; visibility: hidden">görünmez</p>
      <ul><li>Excel bilgisi</li></ul></div>`
    const text = htmlToText(html)
    expect(text).toContain("Aranan nitelikler")
    expect(text).toContain("Excel bilgisi")
    for (const hidden of ["Blockchain", "gizli talimat", "ekran okuyucuya", "görünmez"]) expect(text).not.toContain(hidden)
  })
})
