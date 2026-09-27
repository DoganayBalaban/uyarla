import { describe, expect, it } from "vitest"
import { htmlMetin, ilanMetniCikar, izinliAdres } from "./ilanBaglantisi"

describe("izinliAdres", () => {
  it.each([
    "https://www.kariyer.net/is-ilani/acme-frontend-gelistirici-123",
    "https://tr.linkedin.com/jobs/view/4012345678",
    "http://boards.greenhouse.io/acme/jobs/1",
    "https://acme.wd3.myworkdayjobs.com/tr-TR/External/job/1",
  ])("%s kabul (https'e çevrilerek)", (adres) => {
    const url = izinliAdres(adres)
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
  ])("%s reddediliyor", (adres) => {
    expect(izinliAdres(adres)).toBeNull()
  })
})

describe("htmlMetin", () => {
  it("paragrafları ve maddeleri satıra çeviriyor, varlıkları çözüyor", () => {
    const html =
      "<p>Aradığımız <strong>nitelikler</strong>:</p><ul><li>React &amp; TypeScript</li><li>3+ yıl</li></ul><script>x()</script><p>Ş&#305;k &#x130;stanbul&nbsp;ofis</p>"
    expect(htmlMetin(html)).toBe("Aradığımız nitelikler:\n\n- React & TypeScript\n- 3+ yıl\nŞık İstanbul ofis")
  })
})

describe("ilanMetniCikar", () => {
  const aciklama = "<p>Frontend ekibimize katılacak bir geliştirici arıyoruz.</p><ul><li>React deneyimi</li><li>TypeScript</li><li>Birim testi yazma alışkanlığı</li></ul>"

  it("JSON-LD JobPosting'i tercih ediyor (@graph içinde de)", () => {
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "X" },
        { "@type": "JobPosting", title: "Frontend Geliştirici", hiringOrganization: { name: "Acme" }, description: aciklama },
      ],
    }
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><nav>Menü</nav></body></html>`
    const ilan = ilanMetniCikar(html)!
    expect(ilan.kaynak).toBe("json-ld")
    expect(ilan.pozisyon).toBe("Frontend Geliştirici")
    expect(ilan.sirket).toBe("Acme")
    expect(ilan.metin.startsWith("Frontend Geliştirici — Acme\n\nFrontend ekibimize")).toBe(true)
    expect(ilan.metin).toContain("- React deneyimi")
    expect(ilan.metin).not.toContain("Menü")
  })

  it("JSON-LD yoksa ana içeriğe düşüyor, menü ve alt bilgiyi atıyor", () => {
    const html = `<html><head><title>Veri Analisti | Beta</title></head><body><nav>Giriş Yap Kayıt Ol</nav><main><h1>Veri Analisti</h1>${aciklama.repeat(2)}</main><footer>© Beta</footer></body></html>`
    const ilan = ilanMetniCikar(html)!
    expect(ilan.kaynak).toBe("sayfa")
    expect(ilan.pozisyon).toBe("Veri Analisti | Beta")
    expect(ilan.metin.startsWith("Veri Analisti | Beta\n\n")).toBe(true)
    expect(ilan.metin).not.toContain("Giriş Yap")
    expect(ilan.metin).not.toContain("© Beta")
  })

  it("Kariyer.net: ilanı başlık ile şirket/maaş bölümleri arasına kırpıyor", () => {
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
    const ilan = ilanMetniCikar(html, "www.kariyer.net")!
    expect(ilan.pozisyon).toBe("Dija & Co Sosyal Medya Uzmanı")
    expect(ilan.metin.startsWith("Dija & Co Sosyal Medya Uzmanı\n\nGörev ve Sorumluluklar")).toBe(true)
    expect(ilan.metin).toContain("- Instagram, Facebook, LinkedIn ve TikTok platformlarına hakim")
    for (const gurultu of ["Kaydet Başvur", "60 başvuru", "Prova", "yaratıcı bir ajans", "₺46.400"]) {
      expect(ilan.metin).not.toContain(gurultu)
    }
  })

  it("içerik yoksa null (giriş duvarı, boş sayfa)", () => {
    expect(ilanMetniCikar("<html><body><main>Devam etmek için giriş yapın.</main></body></html>")).toBeNull()
  })

  it("bozuk JSON-LD'yi atlayıp sayfaya düşüyor", () => {
    const html = `<script type="application/ld+json">{bozuk</script><main>${aciklama.repeat(3)}</main>`
    expect(ilanMetniCikar(html)?.kaynak).toBe("sayfa")
  })
})
