/** @vitest-environment jsdom */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { profileFromSnapshot, type ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"
import { collectProfileSnapshot } from "./profileCollector.js"

/**
 * Gerçek LinkedIn profil sayfasının (Ekim 2026, "sdui" kartları) main
 * kısmından anonim örnek: yapı aynen, kişisel metin uydurma profil (DOG-157).
 * Sayfa betiği Chrome'un yaptığı gibi kaynağından kuruluyor; fonksiyona bir
 * içe aktarma ya da dış değişken sızarsa burada patlıyor.
 */
// jsdom ortamında import.meta.url dosya adresi değil; yol paket kökünden.
const OWN_PAGE = readFileSync(resolve(process.cwd(), "src/fixtures/linkedin-own-profile.html"), "utf8")
const runInPage = () => new Function(`return (${collectProfileSnapshot.toString()})()`)() as ProfileSnapshot


/** Başkasının profilinde düzenleme bağlantıları yok; rol satırları şirket bağlantısında. */
function asSomeoneElse() {
  for (const a of Array.from(document.querySelectorAll('a[href*="/edit"]'))) a.setAttribute("href", "/company/1/")
}

describe("collectProfileSnapshot (gerçek sayfa yapısı, anonim)", () => {
  beforeEach(() => {
    document.body.innerHTML = OWN_PAGE
  })

  it("recognizes the user's own profile by its edit links, whatever the button text", () => {
    expect(runInPage().own).toBe(true)
    asSomeoneElse()
    expect(runInPage().own).toBe(false)
  })

  it("reads the name, the headline and the whole about text", () => {
    const s = runInPage()
    expect(s.name).toBe("Deniz Aksoy")
    expect(s.headline).toBe("Performance Marketing Specialist | Google Ads • GA4 • Looker Studio")
    expect(s.about?.split("\n")).toEqual([
      "Performans pazarlamasında e-ticaret markalarıyla çalışıyorum.",
      "Meta ve Google kampanyalarını bütçe, hedef kitle ve kreatif tarafıyla yönetiyorum.",
      "Moda Sepeti'nde aylık 1,2 milyon TL bütçeyi yönetiyorum.",
      "Daha önce Parlak Dijital Ajans'ta perakende müşterilerinin kampanyalarını yürüttüm.",
      "Marmara Üniversitesi İşletme bölümünden mezunum.",
      "Veriyle karar vermeyi ve ölçülebilir büyümeyi seviyorum.",
    ])
  })

  it("reads each role's lines in order with the full description, without the 'see more' button", () => {
    const items = runInPage().sections.experience!.items
    expect(items).toHaveLength(4)
    expect(items[0]).toEqual([
      "Performance Marketing Specialist",
      "Moda Sepeti · Tam zamanlı",
      "Mar 2023 - Devam ediyor · 2 yıl 8 ay",
      "İstanbul, Türkiye · Uzaktan",
      "Devam ediyor",
      "via Parlak İK",
      "Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.",
    ])
    expect(items.flat().join(" ")).not.toMatch(/daha fazla|…/)
  })

  it("takes the totals of shortened sections from their headings", () => {
    const s = runInPage()
    expect(s.sections.skills).toMatchObject({ items: [expect.arrayContaining(["Google Ads"]), expect.arrayContaining(["Looker Studio"])] })
    expect(s.sections.skills!.showAllText).toMatch(/25/)
    expect(s.sections.certifications!.showAllText).toMatch(/5/)
  })

  it("turns the page into profile data end to end", () => {
    const p = profileFromSnapshot(runInPage())
    expect(p.experience).toHaveLength(4)
    expect(p.experience[0]).toEqual({
      title: "Performance Marketing Specialist",
      company: "Moda Sepeti",
      dateRange: "Mar 2023 - Devam ediyor · 2 yıl 8 ay",
      location: "İstanbul, Türkiye · Uzaktan",
      description: "via Parlak İK\nMeta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.",
    })
    expect(p.experience[1]).toEqual({
      title: "Digital Marketing Executive",
      company: "Parlak Dijital Ajans",
      dateRange: "Eyl 2021 - Şub 2023 · 1 yıl 6 ay",
      location: null,
      description: "Perakende müşterilerinin arama kampanyalarını yönettim.",
    })
    expect(p.education).toEqual([{ school: "Marmara Üniversitesi", degree: "Lisans, İşletme", dateRange: "Eyl 2017 – Haz 2021", description: "Not: 3.10" }])
    expect(p.certifications).toEqual([
      { name: "Google Ads Search Certification", issuer: "Google", date: "Oca 2024" },
      { name: "Google Analytics Sertifikası", issuer: "Skillshop", date: "Oca 2024" },
    ])
    expect(p.skills).toEqual(["Google Ads", "Looker Studio"])
    expect(p.languages).toEqual([])
    expect(p.truncated).toEqual({ certifications: { shown: 2, total: 5 }, skills: { shown: 2, total: 25 } })
  })

})
