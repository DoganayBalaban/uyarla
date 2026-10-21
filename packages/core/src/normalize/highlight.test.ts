import { describe, expect, it } from "vitest"
import { keywordSpans } from "./highlight.js"
import { containsKeyword } from "./turkish.js"

const marked = (text: string, keywords: string[]) => keywordSpans(text, keywords).map((s) => text.slice(s.start, s.end))

describe("keywordSpans (DOG-92)", () => {
  it("finds inflected and plural forms like the scorer does", () => {
    const text = "React projelerinde REST API'leri geliştirdim; Developed REST APIs."
    expect(marked(text, ["React", "REST API"])).toEqual(["React", "REST API'leri", "REST APIs"])
  })

  it("matches a multi-word term with an apostrophe suffix in the middle", () => {
    const text = "Excel'de pivot tablo ve temel formüller"
    expect(marked(text, ["Excel pivot tablo"])).toEqual(["Excel'de pivot tablo"])
  })

  it("matches multi-word synonyms and keeps longer terms whole", () => {
    expect(marked("Yapay zekâ ürünleri ve makine öğrenmesi modelleri", ["AI", "makine öğrenmesi", "öğrenme"])).toEqual([
      "Yapay zekâ",
      "makine öğrenmesi",
    ])
  })

  it("matches whole words only", () => {
    expect(marked("Django ile çalıştım", ["Go"])).toEqual([])
  })

  it("agrees with containsKeyword on every sample", () => {
    const samples = [
      ["Kimlik doğrulaması ve yetkilendirme", "authentication"],
      ["Python ve FastAPI ile servisler", "Python"],
      ["Takım çalışması", "çalışma takımı"],
      ["İngilizce raporlar hazırladım", "ingilizce"],
      ["SQL sorguları yazdım", "SQL"],
    ] as const
    for (const [text, keyword] of samples) {
      expect(keywordSpans(text, [keyword]).length > 0).toBe(containsKeyword(text, keyword))
    }
  })
})
