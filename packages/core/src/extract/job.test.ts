import { describe, it, expect } from "vitest"
import { extractJobPosting } from "./job.js"
import type { ExtractOptions, LlmProvider } from "../llm/types.js"

const DRAFT = {
  position: "Frontend Geliştirici",
  company: "Acme",
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "3 yıl React deneyimi", type: "experience", importance: "must" },
    { text: "Tercihen Next.js", type: "skill", importance: "nice" },
  ],
}

const KEYWORDS = { keywords: [["react", "react.js"], ["next.js", "nextjs"]] }

function fakeLlm(
  responses: Record<string, unknown>,
): LlmProvider & { calls: ExtractOptions[] } {
  const calls: ExtractOptions[] = []
  return {
    calls,
    async extract<T>(opts: ExtractOptions) {
      calls.push(opts)
      const data = responses[opts.schemaName]
      if (data === undefined) throw new Error(`beklenmeyen şema: ${opts.schemaName}`)
      return { data: data as T, tokens: 25 }
    },
  }
}

const RESPONSES: Record<string, unknown> = {
  job_posting_draft: DRAFT,
  requirement_keywords: KEYWORDS,
}

describe("extractJobPosting", () => {
  it("iki çağrının sonucunu birleştirir", async () => {
    const llm = fakeLlm(RESPONSES)
    const { data, tokens } = await extractJobPosting(llm, "ilan metni")

    expect(llm.calls.map((c) => c.schemaName)).toEqual([
      "job_posting_draft",
      "requirement_keywords",
    ])
    expect(data.requirements[0]!.keywords).toEqual(["react", "react.js"])
    expect(data.requirements[1]!.keywords).toEqual(["next.js", "nextjs"])
    expect(tokens).toBe(50)
  })

  it("anahtar kelime çağrısına gereksinimleri numaralı gönderir", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractJobPosting(llm, "ilan metni")

    const kw = llm.calls.find((c) => c.schemaName === "requirement_keywords")!
    expect(kw.input).toBe("1. 3 yıl React deneyimi\n2. Tercihen Next.js")
  })

  it("zorunlu ve tercihen ayrımını korur", async () => {
    const { data } = await extractJobPosting(fakeLlm(RESPONSES), "ilan metni")
    expect(data.requirements.map((r) => r.importance)).toEqual(["must", "nice"])
  })

  it("şirket ve kıdem bilinmiyorsa null taşır", async () => {
    const { data } = await extractJobPosting(
      fakeLlm({ ...RESPONSES, job_posting_draft: { ...DRAFT, company: null, seniority: null } }),
      "ilan metni",
    )
    expect(data.company).toBeNull()
    expect(data.seniority).toBeNull()
  })

  it("hizalama eksikse kalan gereksinimi anahtar kelimesiz bırakır", async () => {
    // Sessizce yanlış eşleştirmektense anahtar kelimesiz bırakmak yeğdir:
    // skorlamada anlamsal eşleşmeye düşer.
    const { data } = await extractJobPosting(
      fakeLlm({ ...RESPONSES, requirement_keywords: { keywords: [["react"]] } }),
      "ilan metni",
    )
    expect(data.requirements[0]!.keywords).toEqual(["react"])
    expect(data.requirements[1]!.keywords).toEqual([])
  })

  it("gereksinim yoksa ikinci çağrıyı hiç yapmaz", async () => {
    const llm = fakeLlm({ job_posting_draft: { ...DRAFT, requirements: [] } })
    const { data, tokens } = await extractJobPosting(llm, "ilan metni")

    expect(llm.calls).toHaveLength(1)
    expect(data.requirements).toEqual([])
    expect(tokens).toBe(25)
  })

  it("şemaya uymayan çıktıyı reddeder", async () => {
    await expect(
      extractJobPosting(fakeLlm({ job_posting_draft: { position: "X" } }), "ilan metni"),
    ).rejects.toThrow()
  })

  it("tanımsız önem değerini reddeder", async () => {
    await expect(
      extractJobPosting(
        fakeLlm({
          ...RESPONSES,
          job_posting_draft: {
            ...DRAFT,
            requirements: [{ text: "a", type: "skill", importance: "belki" }],
          },
        }),
        "ilan metni",
      ),
    ).rejects.toThrow()
  })
})
