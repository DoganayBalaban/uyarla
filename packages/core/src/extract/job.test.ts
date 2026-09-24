import { describe, it, expect, vi } from "vitest"
import type { ExtractOptions, LlmProvider } from "../llm/types.js"
import { extractJobPosting } from "./job.js"

const DRAFT = {
  position: "Frontend Geliştirici",
  company: "Acme",
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "Python, REST API ve SQL deneyimi", type: "skill", importance: "must" },
    { text: "Tercihen Next.js", type: "skill", importance: "nice" },
  ],
}

const llmReturning = (data: unknown): LlmProvider => ({
  async extract<T>(_opts: ExtractOptions) {
    return { data: data as T, tokens: 25 }
  },
})

describe("extractJobPosting", () => {
  it("tek çağrı yapar; kavramlar kodda üretilir", async () => {
    // İkinci LLM çağrısı kaldırıldı (K-23): kavramlara bölmek metin işlemedir,
    // yorum gerektirmiyor. Hizalama doğrulaması da gereksizleşti (K-18).
    const extract = vi.fn().mockResolvedValue({ data: DRAFT, tokens: 25 })
    await extractJobPosting({ extract } as unknown as LlmProvider, "ilan metni")

    expect(extract).toHaveBeenCalledOnce()
    expect((extract.mock.calls[0]![0] as ExtractOptions).schemaName).toBe("job_posting_draft")
  })

  it("bileşik gereksinimi kavramlara böler", async () => {
    const { data } = await extractJobPosting(llmReturning(DRAFT), "ilan metni")

    expect(data.requirements[0]!.concepts.map((c) => c.term)).toEqual([
      "Python", "REST API", "SQL",
    ])
    expect(data.requirements[1]!.concepts.map((c) => c.term)).toEqual(["Next.js"])
  })

  it("zorunlu ve tercihen ayrımını korur", async () => {
    const { data } = await extractJobPosting(llmReturning(DRAFT), "ilan metni")
    expect(data.requirements.map((r) => r.importance)).toEqual(["must", "nice"])
  })

  it("şirket ve kıdem bilinmiyorsa null taşır", async () => {
    const { data } = await extractJobPosting(
      llmReturning({ ...DRAFT, company: null, seniority: null }),
      "ilan metni",
    )
    expect(data.company).toBeNull()
    expect(data.seniority).toBeNull()
  })

  it("her gereksinim en az bir kavram taşır", async () => {
    // Skorlama her gereksinim için en az bir kavrama ihtiyaç duyuyor.
    const { data } = await extractJobPosting(
      llmReturning({
        ...DRAFT,
        requirements: [
          { text: "Benzer bir işte en az 5 yıl deneyim sahibi olmak", type: "experience", importance: "must" },
        ],
      }),
      "ilan metni",
    )
    expect(data.requirements[0]!.concepts.length).toBeGreaterThanOrEqual(1)
  })

  it("gereksinim yoksa boş liste döner", async () => {
    const { data } = await extractJobPosting(
      llmReturning({ ...DRAFT, requirements: [] }),
      "ilan metni",
    )
    expect(data.requirements).toEqual([])
  })

  it("şemaya uymayan çıktıyı reddeder", async () => {
    await expect(
      extractJobPosting(llmReturning({ position: "X" }), "ilan metni"),
    ).rejects.toThrow()
  })

  it("tanımsız önem değerini reddeder", async () => {
    await expect(
      extractJobPosting(
        llmReturning({
          ...DRAFT,
          requirements: [{ text: "a", type: "skill", importance: "belki" }],
        }),
        "ilan metni",
      ),
    ).rejects.toThrow()
  })
})
