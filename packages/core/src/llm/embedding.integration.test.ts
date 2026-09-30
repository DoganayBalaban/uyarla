import { describe, it, expect } from "vitest"
import {
  OpenAiCompatibleEmbeddingProvider,
  cosineSimilarity,
  embeddingConfigFromEnv,
} from "./embedding.js"
import { DEFAULT_SCORING_CONFIG } from "../score/config.js"

const THRESHOLD = DEFAULT_SCORING_CONFIG.semanticThreshold

describe("BGE-M3 · real model", () => {
  it("places Turkish synonyms closer than an unrelated phrase", async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
    const [posting, near, far] = await provider.embed([
      "yazılım geliştirici olarak React deneyimi",
      "React ile arayüz geliştiriyorum",
      "muhasebe ve bordro süreçlerini yönettim",
    ])

    const similar = cosineSimilarity(posting!, near!)
    const unrelated = cosineSimilarity(posting!, far!)
    console.log(`[ölçüm] yakın=${similar.toFixed(4)} alakasız=${unrelated.toFixed(4)} eşik=${THRESHOLD}`)

    expect(similar).toBeGreaterThan(unrelated)
    expect(similar).toBeGreaterThan(THRESHOLD)
    expect(unrelated).toBeLessThan(THRESHOLD)
  })

  it("catches a cross-language match", async () => {
    // Ürünün çift dil vaadi (Türkçe CV → İngilizce ilan) buna dayanıyor.
    const provider = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
    const [enPosting, trResume, unrelated] = await provider.embed([
      "experience with version control systems",
      "Git ile versiyon kontrolü kullandım",
      "grafik tasarım ve illüstrasyon",
    ])

    const crossLanguage = cosineSimilarity(enPosting!, trResume!)
    console.log(`[ölçüm] çapraz dilli=${crossLanguage.toFixed(4)} alakasız=${cosineSimilarity(enPosting!, unrelated!).toFixed(4)}`)

    expect(crossLanguage).toBeGreaterThan(cosineSimilarity(enPosting!, unrelated!))
  })

  it("reports a set of real pairs where the threshold discriminates", async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
    const pairs: Array<[string, string, boolean]> = [
      ["React deneyimi", "React ve TypeScript ile panel geliştirdim", true],
      ["Takım çalışmasına yatkın", "4 kişilik ekipte kod inceleme sürecini kurdum", true],
      ["Kubernetes ile konteyner yönetimi", "React ile arayüz geliştirdim", false],
      ["Bilgisayar mühendisliği mezunu", "İstanbul Teknik Üniversitesi, Bilgisayar Mühendisliği", true],
      ["SAP deneyimi", "Sayfa yüklenme süresini düşürdüm", false],
    ]

    const vecs = await provider.embed(pairs.flatMap(([a, b]) => [a, b]))

    console.log("\n  gereksinim ↔ kanıt benzerlikleri:")
    for (const [i, [req, , expectedMatch]] of pairs.entries()) {
      const scoreResult = cosineSimilarity(vecs[i * 2]!, vecs[i * 2 + 1]!)
      const passedCheck = scoreResult >= THRESHOLD
      console.log(
        `   ${passedCheck === expectedMatch ? "✓" : "✗"} ${scoreResult.toFixed(4)} ` +
          `(beklenen ${expectedMatch ? "eşleşme" : "eşleşmeme"}) — ${req}`,
      )
    }

    // Eşik ayarı Görev 13'te eval verisiyle yapılacak; burada yalnızca
    // ayrımın var olduğunu doğruluyoruz.
    const matched = pairs
      .map(([, , b], i) => (b ? cosineSimilarity(vecs[i * 2]!, vecs[i * 2 + 1]!) : null))
      .filter((x): x is number => x !== null)
    const unmatched = pairs
      .map(([, , b], i) => (!b ? cosineSimilarity(vecs[i * 2]!, vecs[i * 2 + 1]!) : null))
      .filter((x): x is number => x !== null)

    expect(Math.min(...matched)).toBeGreaterThan(Math.max(...unmatched))
  })
})
