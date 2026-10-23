/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest"
import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"
import { collectProfileSnapshot } from "./profileCollector.js"

/**
 * Sayfa betiğini Chrome'un yaptığı gibi çalıştırıyor: kaynağı kopyalanıp
 * sayfada yeniden kuruluyor. Fonksiyona bir içe aktarma ya da dış değişken
 * sızarsa burada patlıyor (son inceleme). Sayfa LinkedIn'in yapısına göre
 * kurgusal; gerçek sayfayla deneme mağazaya yüklemeden önce ayrıca yapılıyor.
 */
const runInPage = () => new Function(`return (${collectProfileSnapshot.toString()})()`)() as ProfileSnapshot

const v = (text: string) => `<span aria-hidden="true">${text}</span><span class="visually-hidden">${text}</span>`
const lines = (...texts: string[]) => texts.map((t) => `<div>${v(t)}</div>`).join("")
const section = (id: string, body: string, showAll = "") =>
  `<section><div id="${id}"></div><div>${v(id === "about" ? "Hakkında" : id)}</div>${body}${showAll ? `<a href="/in/deniz/details/${id}/">${showAll}</a>` : ""}</section>`

const page = (own: boolean) => `
  <main>
    <h1>Deniz Aksoy</h1>
    <div class="text-body-medium">Performance Marketing Specialist | Google Ads, GA4</div>
    ${own ? "<button>Add profile section</button>" : "<button>Connect</button>"}
    ${section("about", lines("E-ticaret markalarında Meta ve Google kampanyaları yönetiyorum."))}
    ${section(
      "experience",
      `<ul>
        <li>
          ${lines("Performance Marketing Specialist", "Moda Sepeti · Full-time", "Mar 2023 - Present · 2 yrs 8 mos", "İstanbul, Türkiye · Hybrid")}
          <ul>
            <li>${lines("• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.")}</li>
            <li>${lines("Skills: Google Ads · GA4")}</li>
          </ul>
        </li>
        <li>
          ${lines("Parlak Dijital Ajans", "2 yrs 6 mos")}
          <ul>
            <li>${lines("Digital Marketing Executive", "Full-time", "Eyl 2022 - Şub 2023 · 6 mos", "• Ajans müşterilerinin raporlarını hazırladım.")}</li>
            <li>${lines("Digital Marketing Intern", "Internship", "Eyl 2021 - Ağu 2022 · 1 yr")}</li>
          </ul>
        </li>
      </ul>`,
      "Show all 4 experiences",
    )}
    ${section("skills", `<ul><li>${lines("Google Ads")}</li><li>${lines("Looker Studio")}</li></ul>`, "Show all 25 skills")}
  </main>`

describe("collectProfileSnapshot (sayfada, kaynağından kurulmuş)", () => {
  beforeEach(() => {
    document.body.innerHTML = page(true)
  })

  it("runs self-contained and reads the visible lines once, not the screen reader copy", () => {
    const s = runInPage()
    expect(s.own).toBe(true)
    expect(s.name).toBe("Deniz Aksoy")
    expect(s.headline).toBe("Performance Marketing Specialist | Google Ads, GA4")
    expect(s.about).toBe("E-ticaret markalarında Meta ve Google kampanyaları yönetiyorum.")
    expect(s.sections.skills).toEqual({ items: [["Google Ads"], ["Looker Studio"]], showAllText: "Show all 25 skills" })
  })

  it("keeps a single role with a description and a skills line as one role", () => {
    const [first] = runInPage().sections.experience!.items
    expect(first).toEqual([
      "Performance Marketing Specialist",
      "Moda Sepeti · Full-time",
      "Mar 2023 - Present · 2 yrs 8 mos",
      "İstanbul, Türkiye · Hybrid",
      "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.",
      "Skills: Google Ads · GA4",
    ])
  })

  it("splits several roles at one company, each with the company name", () => {
    const items = runInPage().sections.experience!.items
    expect(items).toHaveLength(3)
    expect(items[1]!.slice(0, 2)).toEqual(["Digital Marketing Executive", "Parlak Dijital Ajans"])
    expect(items[2]!.slice(0, 2)).toEqual(["Digital Marketing Intern", "Parlak Dijital Ajans"])
  })

  it("says someone else's profile is not the user's own", () => {
    document.body.innerHTML = page(false)
    expect(runInPage().own).toBe(false)
  })
})
