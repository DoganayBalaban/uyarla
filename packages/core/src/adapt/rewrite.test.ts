import { describe, it, expect, vi } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { mustConceptTerms, rewriteBullet, rewriteBullets, rewriteSummary } from "./rewrite.js"

const testPosting: JobPostingData = {
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
function fakeLlm(rewritten: string | (() => never)): LlmProvider {
  return {
    extract: vi.fn(async () => {
      if (typeof rewritten === "function") rewritten()
      return { data: { rewritten } as never, tokens: 12 }
    }),
  }
}

describe("mustConceptTerms", () => {
  it("returns only concepts of must requirements", () => {
    expect(mustConceptTerms(testPosting)).toEqual(["React"])
  })

  it("returns a repeated concept once", () => {
    const repeated: JobPostingData = {
      ...testPosting,
      requirements: [testPosting.requirements[0]!, testPosting.requirements[0]!],
    }
    expect(mustConceptTerms(repeated)).toEqual(["React"])
  })
})

/** Hedefli görev: her maddeye bir ilan terimi. */
const job = (bullet: string, targets = ["Web performansı"]) => ({ bullet, targets })

describe("rewriteBullet", () => {
  it("returns the rewritten bullet, alignments and token count", async () => {
    const llm: LlmProvider = {
      extract: vi.fn(async () => ({
        data: {
          rewritten: "Sayfa yüklenme süresini %40 azaltarak web performansını iyileştirdim",
          alignments: [{ term: "Web performansı", basis: "sayfa yüklenme süresini" }],
        } as never,
        tokens: 12,
      })),
    }
    const outcome = await rewriteBullet(llm, job("Sayfa yüklenme süresini %40 azalttım"))
    expect(outcome.data.text).toContain("web performansını")
    expect(outcome.data.alignments).toEqual([
      { term: "Web performansı", basis: "sayfa yüklenme süresini" },
    ])
    expect(outcome.tokens).toBe(12)
  })

  it("gives the model only the bullet and its targets", async () => {
    // K-29: ilanın bütün kavramları verildiğinde model onları maddelere
    // sokuyordu. K-38: yalnızca maddeye yakın hedefler veriliyor.
    const llm = fakeLlm("x")
    await rewriteBullet(llm, job("Panel geliştirdim", ["arayüz"]))

    const call = vi.mocked(llm.extract).mock.calls[0]![0]
    expect(call.input).toContain("Panel geliştirdim")
    expect(call.input).toContain("arayüz")
    for (const termText of ["React", "Kubernetes", "Frontend Geliştirici", "Acme"]) {
      expect(call.input).not.toContain(termText)
    }
  })

  it("does not send a bullet without targets to the model and returns it as is", async () => {
    // Hedefsiz yazım yalnızca eş anlamlı kelime değişikliği üretiyordu (K-38).
    const llm = fakeLlm("değişti")
    const outcome = await rewriteBullet(llm, job("Panel geliştirdim", []))
    expect(llm.extract).not.toHaveBeenCalled()
    expect(outcome.data).toEqual({ text: "Panel geliştirdim", alignments: [] })
    expect(outcome.tokens).toBe(0)
  })

  it("keeps the original when the result is empty", async () => {
    // Model boş string döndürebiliyor; maddeyi silmek veri kaybı olurdu.
    const llm = fakeLlm("   ")
    const outcome = await rewriteBullet(llm, job("React ile panel yaptım"))
    expect(outcome.data.text).toBe("React ile panel yaptım")
  })

  it("does not break on a response without an alignment list", async () => {
    const llm = fakeLlm("React ile paneli geliştirdim")
    const outcome = await rewriteBullet(llm, job("React ile panel yaptım"))
    expect(outcome.data.alignments).toEqual([])
  })
})

describe("rewriteSummary", () => {
  it("rewrites the summary", async () => {
    const llm = fakeLlm("React odaklı frontend geliştiriciyim")
    const outcome = await rewriteSummary(llm, {
      summary: "Frontend geliştirici",
      posting: testPosting,
      supportedTerms: ["React"],
    })
    expect(outcome.data).toBe("React odaklı frontend geliştiriciyim")
  })

  it("gives the model the position title and posting concepts found in the resume", async () => {
    // Özet kullanıcının kendini tanıttığı yer; vurguyu role göre değiştirmek
    // meşru (spec §6.1). CV'de geçmeyen kavram (Kubernetes) verilmez.
    const llm = fakeLlm("x")
    await rewriteSummary(llm, {
      summary: "Frontend geliştirici",
      posting: testPosting,
      supportedTerms: ["React"],
    })
    const scoreInput = vi.mocked(llm.extract).mock.calls[0]![0].input
    expect(scoreInput).toContain("Frontend Geliştirici")
    expect(scoreInput).toContain("React")
    expect(scoreInput).not.toContain("Kubernetes")
  })
})

describe("rewriteBullets", () => {
  it("makes a separate call for each bullet with targets", async () => {
    const llm = fakeLlm("yeni")
    const outcomes = await rewriteBullets(llm, [job("bir"), job("iki", []), job("üç")])
    expect(llm.extract).toHaveBeenCalledTimes(2)
    expect(outcomes.map((s) => s?.data.text)).toEqual(["yeni", "iki", "yeni"])
  })

  it("if one bullet fails only that bullet is null", async () => {
    // Madde başına izolasyon, madde başına çağrının ikinci faydası
    // (spec §13): bir çağrı patlarsa tüm uyarlama değil o madde kaybedilir.
    let counter = 0
    const llm: LlmProvider = {
      extract: vi.fn(async () => {
        counter++
        if (counter === 2) throw new Error("model düştü")
        return { data: { rewritten: "yeni" } as never, tokens: 5 }
      }),
    }
    const outcomes = await rewriteBullets(llm, [job("bir"), job("iki"), job("üç")])
    expect(outcomes.map((s) => s?.data.text ?? null)).toEqual(["yeni", null, "yeni"])
  })

  it("limits concurrent calls and keeps order", async () => {
    // LM Studio istekleri kuyruğa alıyor; sınırsız paralellikte sondaki
    // maddeler zaman aşımına düşerdi.
    let inFlight = 0
    let atMost = 0
    const llm: LlmProvider = {
      extract: vi.fn(async (opts) => {
        inFlight++
        atMost = Math.max(atMost, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
        const bulletItem = opts.input.split("\n")[0]!.replace("Madde: ", "")
        return { data: { rewritten: `${bulletItem}!` } as never, tokens: 1 }
      }),
    }
    const bulletList = ["a", "b", "c", "d", "e", "f", "g"]
    const outcomes = await rewriteBullets(llm, bulletList.map((m) => job(m)), 3)
    expect(atMost).toBe(3)
    expect(outcomes.map((s) => s?.data.text)).toEqual(bulletList.map((m) => `${m}!`))
  })

  it("makes no call for an empty list", async () => {
    const llm = fakeLlm("yeni")
    expect(await rewriteBullets(llm, [])).toEqual([])
    expect(llm.extract).not.toHaveBeenCalled()
  })
})
