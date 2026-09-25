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

describe("rewriteBullet", () => {
  it("yeniden yazılmış maddeyi ve token sayısını döndürür", async () => {
    const llm = sahteLlm("React ile müşteri panelini hayata geçirdim")
    const sonuc = await rewriteBullet(llm, {
      bullet: "React ile panel yaptım",
      posting: ilan,
    })
    expect(sonuc.data).toBe("React ile müşteri panelini hayata geçirdim")
    expect(sonuc.tokens).toBe(12)
  })

  it("modele yalnızca o maddeyi verir, ilan kavramlarını vermez", async () => {
    // Ölçümle karar verildi: kavramlar verildiğinde model onları CV'de
    // geçmedikleri hâlde maddelere sokuyordu (93 maddenin %63'ü işaretlendi,
    // 165 uyarının hepsi enjeksiyon) ve dürüst skor kazancı sıfırdı.
    const llm = sahteLlm("x")
    await rewriteBullet(llm, { bullet: "Panel geliştirdim", posting: ilan })

    const cagri = vi.mocked(llm.extract).mock.calls[0]![0]
    expect(cagri.input).toContain("Panel geliştirdim")
    // İlanda geçen ama maddede geçmeyen hiçbir terim girdiye sızmamalı.
    for (const terim of ["React", "Kubernetes", "Frontend Geliştirici", "Acme"]) {
      expect(cagri.input).not.toContain(terim)
    }
  })

  it("boş dönerse orijinali korur", async () => {
    // Model boş string döndürebiliyor; maddeyi silmek veri kaybı olurdu.
    const llm = sahteLlm("   ")
    const sonuc = await rewriteBullet(llm, { bullet: "React ile panel yaptım", posting: ilan })
    expect(sonuc.data).toBe("React ile panel yaptım")
  })
})

describe("rewriteSummary", () => {
  it("özeti yeniden yazar", async () => {
    const llm = sahteLlm("React odaklı frontend geliştirici")
    const sonuc = await rewriteSummary(llm, {
      summary: "Frontend geliştirici",
      posting: ilan,
    })
    expect(sonuc.data).toBe("React odaklı frontend geliştirici")
  })

  it("modele pozisyon adını da verir", async () => {
    // Özet kullanıcının kendini tanıttığı yer; vurguyu role göre değiştirmek
    // meşru (spec §6.1).
    const llm = sahteLlm("x")
    await rewriteSummary(llm, { summary: "Frontend geliştirici", posting: ilan })
    expect(vi.mocked(llm.extract).mock.calls[0]![0].input).toContain("Frontend Geliştirici")
  })
})

describe("rewriteBullets", () => {
  it("her madde için ayrı çağrı yapar", async () => {
    const llm = sahteLlm("yeni")
    const sonuclar = await rewriteBullets(llm, ["bir", "iki", "üç"], ilan)
    expect(llm.extract).toHaveBeenCalledTimes(3)
    expect(sonuclar.map((s) => s?.data)).toEqual(["yeni", "yeni", "yeni"])
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
    const sonuclar = await rewriteBullets(llm, ["bir", "iki", "üç"], ilan)
    expect(sonuclar.map((s) => s?.data ?? null)).toEqual(["yeni", null, "yeni"])
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
    const sonuclar = await rewriteBullets(llm, maddeler, ilan, 3)
    expect(enFazla).toBe(3)
    expect(sonuclar.map((s) => s?.data)).toEqual(maddeler.map((m) => `${m}!`))
  })

  it("boş listede çağrı yapmaz", async () => {
    const llm = sahteLlm("yeni")
    expect(await rewriteBullets(llm, [], ilan)).toEqual([])
    expect(llm.extract).not.toHaveBeenCalled()
  })
})
