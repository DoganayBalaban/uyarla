import { describe, expect, it } from "vitest"
import { measurableResults } from "./measurable.js"

describe("measurableResults", () => {
  it("counts percentages, amounts, counts and multipliers as results", () => {
    const r = measurableResults(
      [
        "Yıllık satış hedefinin %112'sini gerçekleştirdim.",
        "Bölgedeki 60 müşteriyi düzenli olarak ziyaret ettim.",
        "Kampanya bütçesini 1,2 milyon TL olarak yönettim.",
        "Raporlama süresini 3x hızlandıran bir panel kurdum.",
        "Reklam harcamasını ₺ bazında takip ettim ve raporladım.",
      ].join("\n"),
    )
    expect(r).toEqual({ statements: 5, quantified: 5, examples: [] })
  })

  it("does not count years, date ranges or digits glued to letters", () => {
    const r = measurableResults(
      [
        "2019 – 2022 yılları arasında müşteri ilişkilerini yönettim.",
        "03/2021 tarihinden beri ISO9001 süreçlerini takip ediyorum.",
        "İngilizce B2 seviyesinde yazışmaları yürüttüm ve raporladım.",
        "AWS S3 üzerinde dosya depolama altyapısını kurdum.",
      ].join("\n"),
    )
    expect(r.quantified).toBe(0)
    expect(r.statements).toBe(4)
  })

  it("splits paragraphs into sentences and skips title, date and contact lines", () => {
    const r = measurableResults(
      [
        "Bir Telekom Şirketi — AI Engineer  |  Istanbul / Remote  |  May 2026 – Present",
        "2022 – Halen",
        "Anadolu İş Makinaları (Komatsu bayisi)",
        "İnsan Kaynakları Uzmanı · Gebze, Kocaeli · selin.demir@ornek.com · 0555",
        "60 müşteriyi düzenli ziyaret ettim. Kiralama çözümleri sundum. Görüşmeleri Salesforce'a girdim.",
      ].join("\n"),
    )
    expect(r.statements).toBe(3)
    expect(r.quantified).toBe(1)
    expect(r.examples).toEqual(["Kiralama çözümleri sundum.", "Görüşmeleri Salesforce'a girdim."])
  })

  it("keeps only the first three unquantified statements as examples", () => {
    const r = measurableResults(
      ["Birinci görevi başarıyla tamamladım.", "İkinci görevi başarıyla tamamladım.", "Üçüncü görevi başarıyla tamamladım.", "Dördüncü görevi başarıyla tamamladım."].join(
        "\n",
      ),
    )
    expect(r.examples).toHaveLength(3)
  })
})

describe("measurableResults · wrapped PDF lines", () => {
  it("joins a bullet that the PDF broke across lines", () => {
    const r = measurableResults(
      [
        "• Facebook ve Instagram reklam kampanyalarını aylık 1,2 milyon TL",
        "bütçeyle yönettim.",
        "• Almanya ve Hollanda pazarları için ayrı hesap yapıları kurup yerel",
        "kampanyaları yönettim.",
        "Mart 2023 - Present (2 yıl 7 ay)",
      ].join("\n"),
    )
    expect(r.statements).toBe(2)
    expect(r.quantified).toBe(1)
    expect(r.examples).toEqual(["Almanya ve Hollanda pazarları için ayrı hesap yapıları kurup yerel kampanyaları yönettim."])
  })
})
