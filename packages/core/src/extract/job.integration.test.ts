import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { extractJobPosting } from "./job.js"

const POSTING = `Frontend Geliştirici (Acme Teknoloji)

Aradığımız nitelikler:
- En az 3 yıl React deneyimi
- TypeScript bilgisi şarttır
- Git ile versiyon kontrolü deneyimi
- Bilgisayar mühendisliği veya ilgili bölüm mezunu

Tercihen:
- Next.js deneyimi
- Takım çalışmasına yatkın olmak`

describe("extractJobPosting · real model", () => {
  it("separates required and preferred requirements", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const startedAt = Date.now()
    const { data, tokens } = await extractJobPosting(llm, POSTING)
    console.log(`[ölçüm] ilan çıkarımı ${Date.now() - startedAt} ms, ${tokens} token`)

    expect(data.position).toMatch(/frontend/i)
    expect(data.requirements.length).toBeGreaterThanOrEqual(6)
    // K-11 gerileme koruması: tek çağrılı şemada "Tercihen" bölümü tümüyle
    // düşüyordu ve hiç nice gereksinim kalmıyordu.
    expect(data.requirements.filter((r) => r.importance === "must").length).toBeGreaterThanOrEqual(4)
    expect(data.requirements.filter((r) => r.importance === "nice").length).toBeGreaterThanOrEqual(2)
  })

  it("the keywords field yields words searchable in a resume", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractJobPosting(llm, POSTING)

    for (const req of data.requirements) {
      console.log(`  [${req.importance}/${req.type}] ${req.text} -> ${JSON.stringify(req.concepts.flatMap((c) => c.synonyms))}`)
    }

    // Skorun tamamı buna bağlı: keywords, CV metninde geçebilecek kısa
    // terimler olmalı; gereksinim cümlesinin kopyası değil.
    const all = data.requirements.flatMap((r) => r.concepts.flatMap((c) => c.synonyms).map((k) => k.toLowerCase()))
    expect(all).toContain("react")
    expect(all.some((k) => k.includes("typescript"))).toBe(true)

    // Anahtar kelimeler cümle değil terim olmalı.
    const longOnes = all.filter((k) => k.split(/\s+/).length > 4)
    expect(longOnes).toEqual([])
  })

  it("classifies an education requirement as education", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractJobPosting(llm, POSTING)
    expect(data.requirements.some((r) => r.type === "education")).toBe(true)
  })
})
