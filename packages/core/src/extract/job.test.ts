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
  it("makes a single call; concepts are produced in code", async () => {
    // İkinci LLM çağrısı kaldırıldı (K-23): kavramlara bölmek metin işlemedir,
    // yorum gerektirmiyor. Hizalama doğrulaması da gereksizleşti (K-18).
    const extract = vi.fn().mockResolvedValue({ data: DRAFT, tokens: 25 })
    await extractJobPosting({ extract } as unknown as LlmProvider, "ilan metni")

    expect(extract).toHaveBeenCalledOnce()
    expect((extract.mock.calls[0]![0] as ExtractOptions).schemaName).toBe("job_posting_draft")
  })

  it("splits a compound requirement into concepts", async () => {
    const { data } = await extractJobPosting(llmReturning(DRAFT), "ilan metni")

    expect(data.requirements[0]!.concepts.map((c) => c.term)).toEqual([
      "Python", "REST API", "SQL",
    ])
    expect(data.requirements[1]!.concepts.map((c) => c.term)).toEqual(["Next.js"])
  })

  it("keeps the required/preferred distinction", async () => {
    const { data } = await extractJobPosting(llmReturning(DRAFT), "ilan metni")
    expect(data.requirements.map((r) => r.importance)).toEqual(["must", "nice"])
  })

  it("carries null when company and seniority are unknown", async () => {
    const { data } = await extractJobPosting(
      llmReturning({ ...DRAFT, company: null, seniority: null }),
      "ilan metni",
    )
    expect(data.company).toBeNull()
    expect(data.seniority).toBeNull()
  })

  it("every requirement has at least one concept", async () => {
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

  it("returns an empty list when there are no requirements", async () => {
    const { data } = await extractJobPosting(
      llmReturning({ ...DRAFT, requirements: [] }),
      "ilan metni",
    )
    expect(data.requirements).toEqual([])
  })

  it("rejects output that does not match the schema", async () => {
    await expect(
      extractJobPosting(llmReturning({ position: "X" }), "ilan metni"),
    ).rejects.toThrow()
  })

  it("rejects an undefined importance value", async () => {
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
