import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { JobPostingSchema, jobPostingJsonSchema } from "./job.js"

const ILAN = `Frontend Geliştirici (Acme Teknoloji)

Aradığımız nitelikler:
- En az 3 yıl React deneyimi
- TypeScript bilgisi şarttır
- Git ile versiyon kontrolü

Tercihen:
- Next.js deneyimi
- Takım çalışmasına yatkın olmak`

const PROMPT = `İlandaki her gereksinimi ayrı madde olarak çıkar.
type: skill (teknik), experience (deneyim), education (eğitim), soft (kişisel özellik).
importance: "şart", "zorunlu", "aranan" ise must; "tercihen", "artı olur" ise nice.
keywords: CV'de ararken kullanılacak kelimeler, eş anlamlılarıyla.
Şirket adı ilanda yoksa null yaz. Kıdem belirtilmemişse null yaz.`

describe("İlan şeması · gerçek model", () => {
  it("strict kısıtı altında geçerli ve Zod'dan geçen çıktı üretir", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data, tokens } = await llm.extract({
      prompt: PROMPT,
      schemaName: "job_posting",
      schema: jobPostingJsonSchema,
      input: ILAN,
    })

    // Asıl iddia: şema kısıtı gerçekten uygulanıyor ve çıktı Zod'dan geçiyor.
    const parsed = JobPostingSchema.parse(data)

    expect(parsed.position).toMatch(/frontend/i)
    expect(parsed.requirements.length).toBeGreaterThanOrEqual(3)
    expect(tokens).toBeGreaterThan(0)
  })
})
