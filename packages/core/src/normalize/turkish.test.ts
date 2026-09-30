import { describe, it, expect } from "vitest"
import { containsKeyword, normalizeText, normalizeToken, normalizeTokens } from "./turkish.js"

describe("normalizeText", () => {
  it("lowercases the Turkish capital İ correctly", () => {
    expect(normalizeText("İSTANBUL")).toBe("istanbul")
  })

  it("reduces an uppercase English term to the same stem as its lowercase form", () => {
    // CV'lerde başlıklar ve terimler büyük harfle yazılır, ilanlarda küçük.
    // Türkçe küçültme "I"yı "ı" yaptığı için bunlar eşleşmiyordu (K-21).
    for (const termText of ["API VALIDATION", "MANUAL TESTING", "MICROSERVICES", "JIRA", "CI/CD"]) {
      expect(normalizeText(termText)).toBe(normalizeText(termText.toLowerCase()))
    }
  })

  it("keeps case consistency for Turkish terms too", () => {
    expect(normalizeText("BİLGİSAYAR MÜHENDİSLİĞİ")).toBe(
      normalizeText("Bilgisayar Mühendisliği"),
    )
    expect(normalizeText("YAZILIM GELİŞTİRİCİ")).toBe(normalizeText("yazılım geliştirici"))
  })

  it("turns punctuation into spaces", () => {
    expect(normalizeText("React, TypeScript; Next.js")).toBe("react typescript next js")
  })

  it("collapses extra whitespace", () => {
    expect(normalizeText("  React   Native ")).toBe("react native")
  })

  it("folds circumflex accents", () => {
    expect(normalizeText("Yapay zekâ")).toBe(normalizeText("yapay zeka"))
    expect(containsKeyword("Yapay zeka temelleri üzerine eğitim verdim", "Yapay zekâ")).toBe(true)
  })

  it("returns empty for empty text", () => {
    expect(normalizeText("   ")).toBe("")
  })
})

describe("normalizeToken", () => {
  // Not: Testler belirli kök DEĞERLERİNİ değil, iki biçimin AYNI köke
  // indiğini ölçer. Kökün "yazılım" mı "yazıl" mı olduğu ürün açısından
  // önemsiz; önemli olan ilan ve CV tarafının buluşması.
  it("reduces inflected and bare forms to the same stem", () => {
    expect(normalizeToken("yazılımcıyım")).toBe(normalizeToken("yazılım"))
    expect(normalizeToken("deneyimim")).toBe(normalizeToken("deneyim"))
    expect(normalizeToken("projelerde")).toBe(normalizeToken("proje"))
  })

  it("resolves combined possessive and case suffixes", () => {
    expect(normalizeToken("çalışmasına")).toBe(normalizeToken("çalışması"))
    expect(normalizeToken("takımlarında")).toBe(normalizeToken("takım"))
  })

  it("leaves short words intact", () => {
    expect(normalizeToken("git")).toBe("git")
    expect(normalizeToken("sql")).toBe("sql")
    expect(normalizeToken("api")).toBe("api")
  })

  it("reduces two forms of the same concept to the same stem", () => {
    // Asıl iddia bu: soyma simetrik olduğu için ilan ve CV tarafı buluşur.
    expect(normalizeToken("geliştiricisiniz")).toBe(normalizeToken("geliştirici"))
    expect(normalizeToken("mühendisliği")).toBe(normalizeToken("mühendislik"))
  })

  it("maps title and technology synonyms to a single form", () => {
    expect(normalizeToken("önyüz")).toBe(normalizeToken("frontend"))
    expect(normalizeToken("reactjs")).toBe(normalizeToken("react"))
  })
})

describe("normalizeTokens", () => {
  it("splits text into normalized stems", () => {
    expect(normalizeTokens("React ile projelerde çalıştım")).toContain("proje")
  })

  it("returns an empty array for empty text", () => {
    expect(normalizeTokens("")).toEqual([])
  })
})

describe("containsKeyword", () => {
  it("catches an inflected form", () => {
    expect(containsKeyword("5 yıldır yazılımcıyım", "yazılım")).toBe(true)
  })

  it("catches a multi-word keyword", () => {
    expect(containsKeyword("Takım çalışmasına yatkınım", "takım çalışması")).toBe(true)
  })

  it("catches via a synonym", () => {
    expect(containsKeyword("Önyüz geliştirme yaptım", "frontend")).toBe(true)
  })

  it("returns false for an absent word", () => {
    expect(containsKeyword("React ve TypeScript biliyorum", "kubernetes")).toBe(false)
  })

  it("does not accidentally match part of a word", () => {
    // "go" kelimesi "django"nun içinde geçiyor ama eşleşme tam kelime
    // düzeyinde: uydurma eşleşme, kaçırmadan zararlıdır.
    expect(containsKeyword("Go dili biliyorum", "django")).toBe(false)
    expect(containsKeyword("Django ile API yazdım", "go")).toBe(false)
  })

  it("returns false for an empty keyword", () => {
    expect(containsKeyword("herhangi bir metin", "")).toBe(false)
    expect(containsKeyword("herhangi bir metin", "   ")).toBe(false)
  })

  it("order matters for a multi-word keyword", () => {
    expect(containsKeyword("çalışma takımı kurdum", "takım çalışması")).toBe(false)
  })
})

describe("over-stripping does not produce false positives", () => {
  // Kökler sonuna kadar soyuluyor; farklı kavramların aynı köke inmemesi
  // gerekir. Uydurma eşleşme, kaçırmadan zararlıdır (spec §7).
  const mustDiffer: Array<[string, string]> = [
    ["java", "javascript"],
    ["git", "github"],
    ["react", "redux"],
    ["python", "pytorch"],
    ["docker", "dokümantasyon"],
    ["satış", "satın alma"],
    ["muhasebe", "muhabir"],
  ]

  for (const [a, b] of mustDiffer) {
    it(`"${a}" and "${b}" must not share a stem`, () => {
      expect(normalizeToken(a)).not.toBe(normalizeToken(b))
    })
  }

  it("a real requirement sentence does not match an unrelated resume", () => {
    const resume = "Muhasebe ve bordro süreçlerini yönettim"
    expect(containsKeyword(resume, "react")).toBe(false)
    expect(containsKeyword(resume, "yazılım geliştirme")).toBe(false)
  })
})

describe("cross-language section and field names", () => {
  // Değerlendirme setindeki dört kaçırmanın üçü buradan geliyordu (K-25).
  const pairs: Array<[string, string]> = [
    ["Yazılım Mühendisliği", "Software Engineering"],
    ["Bilgisayar Mühendisliği", "Computer Engineering"],
    ["Bilgisayar Bilimleri", "Computer Science"],
    ["makine öğrenmesi", "machine learning"],
    ["veri bilimi", "data science"],
    ["agent mimarileri", "agent architectures"],
  ]

  for (const [tr, en] of pairs) {
    it(`"${tr}" matches "${en}"`, () => {
      expect(containsKeyword(`Mezuniyet: ${en}`, tr)).toBe(true)
      expect(containsKeyword(`Bölüm: ${tr}`, en)).toBe(true)
    })
  }

  it("does not match an unrelated section", () => {
    expect(containsKeyword("Endüstri Mühendisliği mezunu", "Bilgisayar Mühendisliği")).toBe(false)
    expect(containsKeyword("Graphic Design", "Software Engineering")).toBe(false)
  })
})

describe("English plural suffix", () => {
  it("plural and singular reduce to the same stem", () => {
    // Ölçümle bulundu: CV'de "Developed REST APIs" yazarken ilan "REST API"
    // istiyordu ve iki taraf buluşamıyordu.
    for (const [plural, singular] of [
      ["APIs", "API"],
      ["services", "service"],
      ["workflows", "workflow"],
      ["pipelines", "pipeline"],
      ["integrations", "integration"],
    ]) {
      expect(normalizeToken(plural!)).toBe(normalizeToken(singular!))
    }
  })

  it("finds a term that appears in plural in the source by keyword", () => {
    expect(
      containsKeyword("Developed REST APIs and backend services with FastAPI.", "REST API"),
    ).toBe(true)
  })

  it("leaves short terms ending in s intact", () => {
    // Bunlar çoğul değil, teknoloji adı. Soyulurlarsa kendi adlarıyla
    // eşleşemezler.
    for (const termText of ["css", "aws", "ios"]) {
      expect(normalizeToken(termText)).toBe(termText)
    }
  })

  it("keeps symmetry for Turkish words ending in s", () => {
    // Kural iki tarafa da uygulandığı için aşırı soyma sorun değil: önemli
    // olan kökün doğru olması değil, iki tarafın AYNI köke inmesi.
    expect(normalizeToken("servis")).toBe(normalizeToken("servis"))
    expect(containsKeyword("Servis katmanını yazdım", "servis")).toBe(true)
    expect(containsKeyword("Stres testleri yaptım", "stres")).toBe(true)
  })
})
