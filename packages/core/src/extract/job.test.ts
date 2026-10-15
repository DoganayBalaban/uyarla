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

describe("extractJobPosting · karşı dildeki karşılıklar (DOG-73)", () => {
  const TR_DRAFT = {
    ...DRAFT,
    requirements: [{ text: "Selenium WebDriver ile test otomasyonu", type: "skill", importance: "must" }],
  }
  const sequence = (...answers: Array<unknown | Error>): LlmProvider & { calls: ExtractOptions[] } => {
    const calls: ExtractOptions[] = []
    return {
      calls,
      async extract<T>(opts: ExtractOptions) {
        calls.push(opts)
        const next = answers[calls.length - 1]
        if (next instanceof Error) throw next
        return { data: next as T, tokens: calls.length === 1 ? 25 : 10 }
      },
    }
  }

  it("adds English equivalents to Turkish concepts in one extra call", async () => {
    // İngilizce CV'de "Automation Testing" yazıyor; karşılık olmadan "test
    // otomasyonu" ne kelimeyle ne anlamla (0,44) eşleşiyordu.
    const llm = sequence(TR_DRAFT, { items: [{ term: "test otomasyonu", equivalents: ["test automation", "automation testing"] }] })
    const { data, tokens } = await extractJobPosting(llm, "ilan metni")

    const concept = data.requirements[0]!.concepts.find((c) => c.term === "test otomasyonu")!
    expect(concept.synonyms).toEqual(["test automation", "automation testing"])
    expect(llm.calls[1]!.schemaName).toBe("concept_equivalents")
    // Özel adlar çevrilmiyor: "Selenium WebDriver" her dilde aynı.
    expect(llm.calls[1]!.input).toContain("test otomasyonu")
    expect(llm.calls[1]!.input).not.toContain("Selenium WebDriver")
    expect(tokens).toBe(35)
  })

  it("keeps the posting when the equivalents call fails", async () => {
    // Karşılıklar bir iyileştirme; çağrı düşerse analiz durmamalı.
    const llm = sequence(TR_DRAFT, new Error("zaman aşımı"))
    const { data } = await extractJobPosting(llm, "ilan metni")
    expect(data.requirements[0]!.concepts.map((c) => c.synonyms)).toEqual([[], []])
  })

  it("ignores equivalents for terms it did not ask about and repeats of the term", async () => {
    const llm = sequence(TR_DRAFT, {
      items: [
        { term: "test otomasyonu", equivalents: ["test otomasyonu", "  ", "test automation"] },
        { term: "Kubernetes", equivalents: ["k8s"] },
      ],
    })
    const { data } = await extractJobPosting(llm, "ilan metni")
    expect(data.requirements[0]!.concepts.flatMap((c) => c.synonyms)).toEqual(["test automation"])
  })

  it("sends a concept that mixes an acronym with an ordinary word", async () => {
    // "API testleri" kısaltma yüzünden özel ad sayılıyor (K-38) ama
    // "testleri" sıradan bir kelime; karşılığı ("API testing") gerekli.
    const llm = sequence(
      { ...DRAFT, requirements: [{ text: "Postman ile API testleri", type: "skill", importance: "must" }] },
      { items: [{ term: "API testleri", equivalents: ["API testing"] }] },
    )
    const { data } = await extractJobPosting(llm, "ilan metni")
    expect(llm.calls[1]!.input).toContain("API testleri")
    expect(llm.calls[1]!.input).not.toContain("Postman")
    expect(data.requirements[0]!.concepts.find((c) => c.term === "API testleri")!.synonyms).toEqual(["API testing"])
  })
})

