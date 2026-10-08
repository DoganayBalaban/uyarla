import { describe, expect, it } from "vitest"
import { orderColumns, type TextItem } from "./pdfLayout.js"

const PAGE_WIDTH = 600

/** Bir satır metni, verilen x'ten başlayan tek bir öğe olarak. Karakter başı 5 pt. */
function line(text: string, x: number, y: number): TextItem {
  return { str: text, x, y, width: text.length * 5, height: 10 }
}

/** Sol sütun 40–260, sağ sütun 320–560: arada 60 pt boşluk. */
function twoColumnPage(): TextItem[] {
  return [
    line("ILGIN ZABUN", 40, 800),
    line("HAKKIMDA", 40, 760),
    line("PROFESYONEL DENEYİM", 320, 760),
    line("Yazılım geliştiricisiyim.", 40, 745),
    line("Python ve web projeleri", 40, 730),
    line("geliştiriyorum.", 40, 715),
    line("YAPAY ZEKA EĞİTMENİ", 320, 745),
    line("• Eğitimler verdim.", 320, 730),
    line("• Destek sağladım.", 320, 715),
    line("BECERİLER", 40, 690),
    line("Python, Git", 40, 675),
    line("STAJYER", 320, 690),
    line("• Veri analizi yaptım.", 320, 675),
  ]
}

describe("orderColumns", () => {
  it("reads the left column fully before the right one", () => {
    const text = orderColumns(twoColumnPage(), PAGE_WIDTH)!

    expect(text.split("\n")).toEqual([
      "ILGIN ZABUN",
      "HAKKIMDA",
      "Yazılım geliştiricisiyim.",
      "Python ve web projeleri",
      "geliştiriyorum.",
      "BECERİLER",
      "Python, Git",
      "PROFESYONEL DENEYİM",
      "YAPAY ZEKA EĞİTMENİ",
      "• Eğitimler verdim.",
      "• Destek sağladım.",
      "STAJYER",
      "• Veri analizi yaptım.",
    ])
  })

  it("returns null for a single-column page with right-aligned dates", () => {
    // Tarihler sağa yaslı ama maddeler sayfa boyunca uzanıyor: sütun yok.
    const items = [
      line("Frontend Geliştirici · Acme", 40, 760),
      line("2022 – halen", 480, 760),
      line("React ve TypeScript ile müşteri paneli geliştirdim ve sürdürdüm", 40, 745),
      line("Sayfa yüklenme süresini yüzde kırk düşürdüm, ekip içi eğitim verdim", 40, 730),
      line("Stajyer · Beta", 40, 710),
      line("2021", 520, 710),
      line("Test otomasyonu kurdum ve hata oranını azalttım, raporlama yaptım", 40, 695),
    ]

    expect(orderColumns(items, PAGE_WIDTH)).toBeNull()
  })

  it("joins items on the same line in x order", () => {
    const items = [...twoColumnPage(), { str: "devamı", x: 175, y: 730, width: 30, height: 10 }]
    const text = orderColumns(items, PAGE_WIDTH)!

    expect(text).toContain("Python ve web projeleri devamı")
  })

  it("splits a narrow sidebar from the main column", () => {
    // cv-c düzeni: solda dar bir kenar sütunu (eğitim, beceriler), sağda
    // geniş ana sütun. Boşluk sayfa genişliğinin ~%24'ünde.
    const items = [
      line("EĞİTİM", 18, 696),
      line("Kafkas Üniversitesi", 18, 671),
      line("BECERİLER", 18, 587),
      line("Python, Git", 18, 565),
      line("DİLLER", 18, 282),
      line("HAKKIMDA", 157, 697),
      line("Yönetim Bilişim Sistemleri mezunuyum, yazılım geliştiriyorum.", 152, 680),
      line("PROFESYONEL DENEYİM", 158, 596),
      line("YAPAY ZEKA EĞİTMENİ", 155, 404),
      line("• Yapay zeka temelleri üzerine eğitimler verdim.", 155, 374),
    ]

    expect(orderColumns(items, 595)!.split("\n")).toEqual([
      "EĞİTİM",
      "Kafkas Üniversitesi",
      "BECERİLER",
      "Python, Git",
      "DİLLER",
      "HAKKIMDA",
      "Yönetim Bilişim Sistemleri mezunuyum, yazılım geliştiriyorum.",
      "PROFESYONEL DENEYİM",
      "YAPAY ZEKA EĞİTMENİ",
      "• Yapay zeka temelleri üzerine eğitimler verdim.",
    ])
  })

  it("returns null when there is too little text to judge", () => {
    expect(orderColumns([line("Tek satır", 40, 700)], PAGE_WIDTH)).toBeNull()
  })
})
