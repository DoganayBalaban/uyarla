import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { extractJobPosting } from "./job.js"

const ILAN = `Frontend Geliştirici (Acme Teknoloji)

Aradığımız nitelikler:
- En az 3 yıl React deneyimi
- TypeScript bilgisi şarttır
- Git ile versiyon kontrolü deneyimi
- Bilgisayar mühendisliği veya ilgili bölüm mezunu

Tercihen:
- Next.js deneyimi
- Takım çalışmasına yatkın olmak`

describe("extractJobPosting · gerçek model", () => {
  it("zorunlu ve tercihen gereksinimleri ayırır", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const basladi = Date.now()
    const { data, tokens } = await extractJobPosting(llm, ILAN)
    console.log(`[ölçüm] ilan çıkarımı ${Date.now() - basladi} ms, ${tokens} token`)

    expect(data.position).toMatch(/frontend/i)
    expect(data.requirements.length).toBeGreaterThanOrEqual(6)
    // K-11 gerileme koruması: tek çağrılı şemada "Tercihen" bölümü tümüyle
    // düşüyordu ve hiç nice gereksinim kalmıyordu.
    expect(data.requirements.filter((r) => r.importance === "must").length).toBeGreaterThanOrEqual(4)
    expect(data.requirements.filter((r) => r.importance === "nice").length).toBeGreaterThanOrEqual(2)
  })

  it("keywords alanı CV'de aranabilir kelimeler üretir", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractJobPosting(llm, ILAN)

    for (const req of data.requirements) {
      console.log(`  [${req.importance}/${req.type}] ${req.text} -> ${JSON.stringify(req.concepts.flatMap((c) => c.synonyms))}`)
    }

    // Skorun tamamı buna bağlı: keywords, CV metninde geçebilecek kısa
    // terimler olmalı; gereksinim cümlesinin kopyası değil.
    const tumu = data.requirements.flatMap((r) => r.concepts.flatMap((c) => c.synonyms).map((k) => k.toLowerCase()))
    expect(tumu).toContain("react")
    expect(tumu.some((k) => k.includes("typescript"))).toBe(true)

    // Anahtar kelimeler cümle değil terim olmalı.
    const uzunlar = tumu.filter((k) => k.split(/\s+/).length > 4)
    expect(uzunlar).toEqual([])
  })

  it("eğitim gereksinimini education olarak sınıflar", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractJobPosting(llm, ILAN)
    expect(data.requirements.some((r) => r.type === "education")).toBe(true)
  })
})
