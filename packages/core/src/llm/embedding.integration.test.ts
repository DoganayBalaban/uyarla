import { describe, it, expect } from "vitest"
import {
  OpenAiCompatibleEmbeddingProvider,
  cosineSimilarity,
  embeddingConfigFromEnv,
} from "./embedding.js"
import { DEFAULT_SCORING_CONFIG } from "../score/config.js"

const ESIK = DEFAULT_SCORING_CONFIG.semanticThreshold

describe("BGE-M3 · gerçek model", () => {
  it("Türkçe eş anlamlı ifadeleri alakasız ifadeden daha yakın konumlandırır", async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
    const [ilan, yakin, uzak] = await provider.embed([
      "yazılım geliştirici olarak React deneyimi",
      "React ile arayüz geliştiriyorum",
      "muhasebe ve bordro süreçlerini yönettim",
    ])

    const benzer = cosineSimilarity(ilan!, yakin!)
    const alakasiz = cosineSimilarity(ilan!, uzak!)
    console.log(`[ölçüm] yakın=${benzer.toFixed(4)} alakasız=${alakasiz.toFixed(4)} eşik=${ESIK}`)

    expect(benzer).toBeGreaterThan(alakasiz)
    expect(benzer).toBeGreaterThan(ESIK)
    expect(alakasiz).toBeLessThan(ESIK)
  })

  it("çapraz dilli eşleşmeyi yakalar", async () => {
    // Ürünün çift dil vaadi (Türkçe CV → İngilizce ilan) buna dayanıyor.
    const provider = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
    const [enIlan, trCv, alakasiz] = await provider.embed([
      "experience with version control systems",
      "Git ile versiyon kontrolü kullandım",
      "grafik tasarım ve illüstrasyon",
    ])

    const capraz = cosineSimilarity(enIlan!, trCv!)
    console.log(`[ölçüm] çapraz dilli=${capraz.toFixed(4)} alakasız=${cosineSimilarity(enIlan!, alakasiz!).toFixed(4)}`)

    expect(capraz).toBeGreaterThan(cosineSimilarity(enIlan!, alakasiz!))
  })

  it("eşiğin ayırt edici olduğu bir dizi gerçek çifti raporlar", async () => {
    const provider = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
    const ciftler: Array<[string, string, boolean]> = [
      ["React deneyimi", "React ve TypeScript ile panel geliştirdim", true],
      ["Takım çalışmasına yatkın", "4 kişilik ekipte kod inceleme sürecini kurdum", true],
      ["Kubernetes ile konteyner yönetimi", "React ile arayüz geliştirdim", false],
      ["Bilgisayar mühendisliği mezunu", "İstanbul Teknik Üniversitesi, Bilgisayar Mühendisliği", true],
      ["SAP deneyimi", "Sayfa yüklenme süresini düşürdüm", false],
    ]

    const vektorler = await provider.embed(ciftler.flatMap(([a, b]) => [a, b]))

    console.log("\n  gereksinim ↔ kanıt benzerlikleri:")
    for (const [i, [gereksinim, , beklenenEslesme]] of ciftler.entries()) {
      const skor = cosineSimilarity(vektorler[i * 2]!, vektorler[i * 2 + 1]!)
      const gecti = skor >= ESIK
      console.log(
        `   ${gecti === beklenenEslesme ? "✓" : "✗"} ${skor.toFixed(4)} ` +
          `(beklenen ${beklenenEslesme ? "eşleşme" : "eşleşmeme"}) — ${gereksinim}`,
      )
    }

    // Eşik ayarı Görev 13'te eval verisiyle yapılacak; burada yalnızca
    // ayrımın var olduğunu doğruluyoruz.
    const eslesenler = ciftler
      .map(([, , b], i) => (b ? cosineSimilarity(vektorler[i * 2]!, vektorler[i * 2 + 1]!) : null))
      .filter((x): x is number => x !== null)
    const eslesmeyenler = ciftler
      .map(([, , b], i) => (!b ? cosineSimilarity(vektorler[i * 2]!, vektorler[i * 2 + 1]!) : null))
      .filter((x): x is number => x !== null)

    expect(Math.min(...eslesenler)).toBeGreaterThan(Math.max(...eslesmeyenler))
  })
})
