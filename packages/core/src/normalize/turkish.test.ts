import { describe, it, expect } from "vitest"
import { containsKeyword, normalizeText, normalizeToken, normalizeTokens } from "./turkish.js"

describe("normalizeText", () => {
  it("Türkçe büyük İ harfini doğru küçültür", () => {
    expect(normalizeText("İSTANBUL")).toBe("istanbul")
  })

  it("büyük harfli İngilizce terimi küçük hâliyle aynı köke indirir", () => {
    // CV'lerde başlıklar ve terimler büyük harfle yazılır, ilanlarda küçük.
    // Türkçe küçültme "I"yı "ı" yaptığı için bunlar eşleşmiyordu (K-21).
    for (const terim of ["API VALIDATION", "MANUAL TESTING", "MICROSERVICES", "JIRA", "CI/CD"]) {
      expect(normalizeText(terim)).toBe(normalizeText(terim.toLowerCase()))
    }
  })

  it("Türkçe terimlerde de büyük-küçük tutarlılığı korunur", () => {
    expect(normalizeText("BİLGİSAYAR MÜHENDİSLİĞİ")).toBe(
      normalizeText("Bilgisayar Mühendisliği"),
    )
    expect(normalizeText("YAZILIM GELİŞTİRİCİ")).toBe(normalizeText("yazılım geliştirici"))
  })

  it("noktalama işaretlerini boşluğa çevirir", () => {
    expect(normalizeText("React, TypeScript; Next.js")).toBe("react typescript next js")
  })

  it("fazla boşlukları tekler", () => {
    expect(normalizeText("  React   Native ")).toBe("react native")
  })

  it("boş metinde boş döner", () => {
    expect(normalizeText("   ")).toBe("")
  })
})

describe("normalizeToken", () => {
  // Not: Testler belirli kök DEĞERLERİNİ değil, iki biçimin AYNI köke
  // indiğini ölçer. Kökün "yazılım" mı "yazıl" mı olduğu ürün açısından
  // önemsiz; önemli olan ilan ve CV tarafının buluşması.
  it("çekimli ve yalın biçimi aynı köke indirir", () => {
    expect(normalizeToken("yazılımcıyım")).toBe(normalizeToken("yazılım"))
    expect(normalizeToken("deneyimim")).toBe(normalizeToken("deneyim"))
    expect(normalizeToken("projelerde")).toBe(normalizeToken("proje"))
  })

  it("iyelik ve hâl eki birleşimlerini çözer", () => {
    expect(normalizeToken("çalışmasına")).toBe(normalizeToken("çalışması"))
    expect(normalizeToken("takımlarında")).toBe(normalizeToken("takım"))
  })

  it("kısa kelimeleri bozmaz", () => {
    expect(normalizeToken("git")).toBe("git")
    expect(normalizeToken("sql")).toBe("sql")
    expect(normalizeToken("api")).toBe("api")
  })

  it("aynı kavramın iki biçimini aynı köke indirir", () => {
    // Asıl iddia bu: soyma simetrik olduğu için ilan ve CV tarafı buluşur.
    expect(normalizeToken("geliştiricisiniz")).toBe(normalizeToken("geliştirici"))
    expect(normalizeToken("mühendisliği")).toBe(normalizeToken("mühendislik"))
  })

  it("unvan ve teknoloji eş anlamlılarını tek biçime çevirir", () => {
    expect(normalizeToken("önyüz")).toBe(normalizeToken("frontend"))
    expect(normalizeToken("reactjs")).toBe(normalizeToken("react"))
  })
})

describe("normalizeTokens", () => {
  it("metni normalleştirilmiş köklere ayırır", () => {
    expect(normalizeTokens("React ile projelerde çalıştım")).toContain("proje")
  })

  it("boş metinde boş dizi döner", () => {
    expect(normalizeTokens("")).toEqual([])
  })
})

describe("containsKeyword", () => {
  it("çekimli biçimi yakalar", () => {
    expect(containsKeyword("5 yıldır yazılımcıyım", "yazılım")).toBe(true)
  })

  it("çok kelimeli anahtar kelimeyi yakalar", () => {
    expect(containsKeyword("Takım çalışmasına yatkınım", "takım çalışması")).toBe(true)
  })

  it("eş anlamlı üzerinden yakalar", () => {
    expect(containsKeyword("Önyüz geliştirme yaptım", "frontend")).toBe(true)
  })

  it("geçmeyen kelimeye false döner", () => {
    expect(containsKeyword("React ve TypeScript biliyorum", "kubernetes")).toBe(false)
  })

  it("kelime parçasını yanlışlıkla eşleştirmez", () => {
    // "go" kelimesi "django"nun içinde geçiyor ama eşleşme tam kelime
    // düzeyinde: uydurma eşleşme, kaçırmadan zararlıdır.
    expect(containsKeyword("Go dili biliyorum", "django")).toBe(false)
    expect(containsKeyword("Django ile API yazdım", "go")).toBe(false)
  })

  it("boş anahtar kelimeye false döner", () => {
    expect(containsKeyword("herhangi bir metin", "")).toBe(false)
    expect(containsKeyword("herhangi bir metin", "   ")).toBe(false)
  })

  it("çok kelimeli anahtar kelimede sıra önemlidir", () => {
    expect(containsKeyword("çalışma takımı kurdum", "takım çalışması")).toBe(false)
  })
})

describe("aşırı soyma yanlış pozitif üretmiyor mu", () => {
  // Kökler sonuna kadar soyuluyor; farklı kavramların aynı köke inmemesi
  // gerekir. Uydurma eşleşme, kaçırmadan zararlıdır (spec §7).
  const farkliOlmali: Array<[string, string]> = [
    ["java", "javascript"],
    ["git", "github"],
    ["react", "redux"],
    ["python", "pytorch"],
    ["docker", "dokümantasyon"],
    ["satış", "satın alma"],
    ["muhasebe", "muhabir"],
  ]

  for (const [a, b] of farkliOlmali) {
    it(`"${a}" ile "${b}" aynı köke inmemeli`, () => {
      expect(normalizeToken(a)).not.toBe(normalizeToken(b))
    })
  }

  it("gerçek bir gereksinim cümlesinde alakasız CV ile eşleşmiyor", () => {
    const cv = "Muhasebe ve bordro süreçlerini yönettim"
    expect(containsKeyword(cv, "react")).toBe(false)
    expect(containsKeyword(cv, "yazılım geliştirme")).toBe(false)
  })
})

describe("çapraz dilli bölüm ve alan adları", () => {
  // Değerlendirme setindeki dört kaçırmanın üçü buradan geliyordu (K-25).
  const ciftler: Array<[string, string]> = [
    ["Yazılım Mühendisliği", "Software Engineering"],
    ["Bilgisayar Mühendisliği", "Computer Engineering"],
    ["Bilgisayar Bilimleri", "Computer Science"],
    ["makine öğrenmesi", "machine learning"],
    ["veri bilimi", "data science"],
    ["agent mimarileri", "agent architectures"],
  ]

  for (const [tr, en] of ciftler) {
    it(`"${tr}" ile "${en}" eşleşir`, () => {
      expect(containsKeyword(`Mezuniyet: ${en}`, tr)).toBe(true)
      expect(containsKeyword(`Bölüm: ${tr}`, en)).toBe(true)
    })
  }

  it("alakasız bölümü eşleştirmez", () => {
    expect(containsKeyword("Endüstri Mühendisliği mezunu", "Bilgisayar Mühendisliği")).toBe(false)
    expect(containsKeyword("Graphic Design", "Software Engineering")).toBe(false)
  })
})
