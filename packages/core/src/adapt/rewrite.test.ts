import { describe, it, expect, vi } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { mustConceptTerms, rewriteBullet, rewriteBullets, rewriteSummary } from "./rewrite.js"

const ilan: JobPostingData = {
  position: "Frontend Geliştirici",
  company: "Acme",
  seniority: "mid",
  language: "tr",
  requirements: [
    {
      text: "React deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "React", synonyms: ["react.js"] }],
    },
    {
      text: "Tercihen Kubernetes",
      type: "skill",
      importance: "nice",
      concepts: [{ term: "Kubernetes", synonyms: [] }],
    },
  ],
}

/** Verilen metni döndüren sahte sağlayıcı. */
function sahteLlm(rewritten: string | (() => never)): LlmProvider {
  return {
    extract: vi.fn(async () => {
      if (typeof rewritten === "function") rewritten()
      return { data: { rewritten } as never, tokens: 12 }
    }),
  }
}

describe("mustConceptTerms", () => {
  it("yalnızca must gereksinimlerinin kavramlarını verir", () => {
    expect(mustConceptTerms(ilan)).toEqual(["React"])
  })

  it("tekrarlanan kavramı bir kez verir", () => {
    const tekrarli: JobPostingData = {
      ...ilan,
      requirements: [ilan.requirements[0]!, ilan.requirements[0]!],
    }
    expect(mustConceptTerms(tekrarli)).toEqual(["React"])
  })
})

/** Hedefli görev: her maddeye bir ilan terimi. */
const gorev = (bullet: string, targets = ["Web performansı"]) => ({ bullet, targets })

describe("rewriteBullet", () => {
  it("yazılmış maddeyi, uyumları ve token sayısını döndürür", async () => {
    const llm: LlmProvider = {
      extract: vi.fn(async () => ({
        data: {
          rewritten: "Sayfa yüklenme süresini %40 azaltarak web performansını iyileştirdim",
          alignments: [{ term: "Web performansı", basis: "sayfa yüklenme süresini" }],
        } as never,
        tokens: 12,
      })),
    }
    const sonuc = await rewriteBullet(llm, gorev("Sayfa yüklenme süresini %40 azalttım"))
    expect(sonuc.data.text).toContain("web performansını")
    expect(sonuc.data.alignments).toEqual([
      { term: "Web performansı", basis: "sayfa yüklenme süresini" },
    ])
    expect(sonuc.tokens).toBe(12)
  })

  it("modele yalnızca maddeyi ve o maddenin hedeflerini verir", async () => {
    // K-29: ilanın bütün kavramları verildiğinde model onları maddelere
    // sokuyordu. K-38: yalnızca maddeye yakın hedefler veriliyor.
    const llm = sahteLlm("x")
    await rewriteBullet(llm, gorev("Panel geliştirdim", ["arayüz"]))

    const cagri = vi.mocked(llm.extract).mock.calls[0]![0]
    expect(cagri.input).toContain("Panel geliştirdim")
    expect(cagri.input).toContain("arayüz")
    for (const terim of ["React", "Kubernetes", "Frontend Geliştirici", "Acme"]) {
      expect(cagri.input).not.toContain(terim)
    }
  })

  it("hedefi olmayan maddeyi modele göndermez, olduğu gibi döndürür", async () => {
    // Hedefsiz yazım yalnızca eş anlamlı kelime değişikliği üretiyordu (K-38).
    const llm = sahteLlm("değişti")
    const sonuc = await rewriteBullet(llm, gorev("Panel geliştirdim", []))
    expect(llm.extract).not.toHaveBeenCalled()
    expect(sonuc.data).toEqual({ text: "Panel geliştirdim", alignments: [] })
    expect(sonuc.tokens).toBe(0)
  })

  it("boş dönerse orijinali korur", async () => {
    // Model boş string döndürebiliyor; maddeyi silmek veri kaybı olurdu.
    const llm = sahteLlm("   ")
    const sonuc = await rewriteBullet(llm, gorev("React ile panel yaptım"))
    expect(sonuc.data.text).toBe("React ile panel yaptım")
  })

  it("uyum listesini atlayan yanıtı patlatmaz", async () => {
    const llm = sahteLlm("React ile paneli geliştirdim")
    const sonuc = await rewriteBullet(llm, gorev("React ile panel yaptım"))
    expect(sonuc.data.alignments).toEqual([])
  })
})

describe("rewriteSummary", () => {
  it("özeti yeniden yazar", async () => {
    const llm = sahteLlm("React odaklı frontend geliştiriciyim")
    const sonuc = await rewriteSummary(llm, {
      summary: "Frontend geliştirici",
      posting: ilan,
      supportedTerms: ["React"],
    })
    expect(sonuc.data).toBe("React odaklı frontend geliştiriciyim")
  })

  it("modele pozisyon adını ve CV'de geçen ilan kavramlarını verir", async () => {
    // Özet kullanıcının kendini tanıttığı yer; vurguyu role göre değiştirmek
    // meşru (spec §6.1). CV'de geçmeyen kavram (Kubernetes) verilmez.
    const llm = sahteLlm("x")
    await rewriteSummary(llm, {
      summary: "Frontend geliştirici",
      posting: ilan,
      supportedTerms: ["React"],
    })
    const girdi = vi.mocked(llm.extract).mock.calls[0]![0].input
    expect(girdi).toContain("Frontend Geliştirici")
    expect(girdi).toContain("React")
    expect(girdi).not.toContain("Kubernetes")
  })
})

describe("rewriteBullets", () => {
  it("hedefi olan her madde için ayrı çağrı yapar", async () => {
    const llm = sahteLlm("yeni")
    const sonuclar = await rewriteBullets(llm, [gorev("bir"), gorev("iki", []), gorev("üç")])
    expect(llm.extract).toHaveBeenCalledTimes(2)
    expect(sonuclar.map((s) => s?.data.text)).toEqual(["yeni", "iki", "yeni"])
  })

  it("bir madde patlarsa yalnızca o madde null olur", async () => {
    // Madde başına izolasyon, madde başına çağrının ikinci faydası
    // (spec §13): bir çağrı patlarsa tüm uyarlama değil o madde kaybedilir.
    let sayac = 0
    const llm: LlmProvider = {
      extract: vi.fn(async () => {
        sayac++
        if (sayac === 2) throw new Error("model düştü")
        return { data: { rewritten: "yeni" } as never, tokens: 5 }
      }),
    }
    const sonuclar = await rewriteBullets(llm, [gorev("bir"), gorev("iki"), gorev("üç")])
    expect(sonuclar.map((s) => s?.data.text ?? null)).toEqual(["yeni", null, "yeni"])
  })

  it("eşzamanlı çağrı sayısını sınırlar ve sırayı korur", async () => {
    // LM Studio istekleri kuyruğa alıyor; sınırsız paralellikte sondaki
    // maddeler zaman aşımına düşerdi.
    let ucusta = 0
    let enFazla = 0
    const llm: LlmProvider = {
      extract: vi.fn(async (opts) => {
        ucusta++
        enFazla = Math.max(enFazla, ucusta)
        await new Promise((r) => setTimeout(r, 5))
        ucusta--
        const madde = opts.input.split("\n")[0]!.replace("Madde: ", "")
        return { data: { rewritten: `${madde}!` } as never, tokens: 1 }
      }),
    }
    const maddeler = ["a", "b", "c", "d", "e", "f", "g"]
    const sonuclar = await rewriteBullets(llm, maddeler.map((m) => gorev(m)), 3)
    expect(enFazla).toBe(3)
    expect(sonuclar.map((s) => s?.data.text)).toEqual(maddeler.map((m) => `${m}!`))
  })

  it("boş listede çağrı yapmaz", async () => {
    const llm = sahteLlm("yeni")
    expect(await rewriteBullets(llm, [])).toEqual([])
    expect(llm.extract).not.toHaveBeenCalled()
  })
})
