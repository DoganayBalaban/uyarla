import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { extractJobPosting } from "../src/extract/job.js"
import { extractResumeProfile } from "../src/extract/resume.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import { DEFAULT_SCORING_CONFIG } from "../src/score/config.js"
import { collectEvidence } from "../src/score/evidence.js"
import { score } from "../src/score/score.js"
import { compareToExpectations } from "./compare.js"
import type { EvalPair, EvalTotals, PairMetrics } from "./types.js"

const PAIRS_DIR = join(import.meta.dirname, "pairs")
const RUNS_DIR = join(import.meta.dirname, "runs")

async function main() {
  const llmConfig = llmConfigFromEnv()
  const llm = new LmStudioProvider(llmConfig)
  const embeddingConfig = embeddingConfigFromEnv()
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfig)

  const dosyalar = readdirSync(PAIRS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()

  if (dosyalar.length === 0) {
    console.error(`[eval] ${PAIRS_DIR} altında çift bulunamadı.`)
    process.exit(1)
  }

  console.log(`[eval] ${dosyalar.length} çift · model: ${llmConfig.model}\n`)

  const metrics: PairMetrics[] = []
  for (const dosya of dosyalar) {
    const pair = JSON.parse(readFileSync(join(PAIRS_DIR, dosya), "utf8")) as EvalPair
    const basladi = Date.now()
    process.stdout.write(`  ${pair.id} … `)

    try {
      const profil = await extractResumeProfile(llm, pair.resumeText)
      const ilan = await extractJobPosting(llm, pair.jobText)

      const kanitlar = collectEvidence(profil.data)
      const kanitMetinleri = kanitlar.map((k) => k.text)
      const gereksinimMetinleri = ilan.data.requirements.map((r) => r.text)
      const vektorler = await embedding.embed([...kanitMetinleri, ...gereksinimMetinleri])

      const sonuc = score({
        profile: profil.data,
        posting: ilan.data,
        evidence: kanitlar,
        evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
        requirementVectors: vektorler.slice(kanitMetinleri.length),
      })

      const m = compareToExpectations(pair.id, sonuc, pair.expectations, Date.now() - basladi)
      metrics.push(m)
      console.log(
        `skor ${m.score} · isabet ${m.hits} · kaçırma ${m.misses} · uydurma ${m.fabrications} · ${Math.round(m.durationMs / 1000)}s`,
      )
    } catch (error) {
      console.log(`HATA: ${(error as Error).message}`)
      metrics.push({
        id: pair.id, hits: 0, misses: 0, fabrications: 0,
        notExtracted: pair.expectations.length, score: 0,
        durationMs: Date.now() - basladi, byKeyword: 0, bySemantic: 0,
      })
    }
  }

  console.table(
    metrics.map((m) => ({
      çift: m.id, skor: m.score, isabet: m.hits, kaçırma: m.misses,
      uydurma: m.fabrications, çıkarılmayan: m.notExtracted,
      kelime: m.byKeyword, anlamsal: m.bySemantic, saniye: Math.round(m.durationMs / 1000),
    })),
  )

  const toplam: EvalTotals = metrics.reduce(
    (acc, m) => ({
      hits: acc.hits + m.hits,
      misses: acc.misses + m.misses,
      fabrications: acc.fabrications + m.fabrications,
      notExtracted: acc.notExtracted + m.notExtracted,
      byKeyword: acc.byKeyword + m.byKeyword,
      bySemantic: acc.bySemantic + m.bySemantic,
    }),
    { hits: 0, misses: 0, fabrications: 0, notExtracted: 0, byKeyword: 0, bySemantic: 0 },
  )

  const kontrolEdilen = toplam.hits + toplam.misses + toplam.fabrications
  const isabetOrani = kontrolEdilen === 0 ? 0 : toplam.hits / kontrolEdilen
  const ortalamaSure = Math.round(
    metrics.reduce((t, m) => t + m.durationMs, 0) / (metrics.length || 1),
  )

  console.log("\n--- Toplam ---")
  console.log(`İsabet oranı   : ${(isabetOrani * 100).toFixed(1)}%`)
  console.log(`Kaçırma        : ${toplam.misses}`)
  console.log(`Uydurma        : ${toplam.fabrications}   <- en zararlısı`)
  console.log(`Çıkarılmayan   : ${toplam.notExtracted}   <- ilan çıkarımı sorunu`)
  console.log(`Eşleşme kaynağı: kelime ${toplam.byKeyword} · anlamsal ${toplam.bySemantic}`)
  console.log(`Ortalama süre  : ${(ortalamaSure / 1000).toFixed(1)} sn`)
  console.log(`Model          : ${llmConfig.model} · embedding: ${embeddingConfig.model}`)
  console.log(`Eşik / ağırlık : ${JSON.stringify(DEFAULT_SCORING_CONFIG)}`)

  mkdirSync(RUNS_DIR, { recursive: true })
  const damga = new Date().toISOString().replace(/[:.]/g, "-")
  const yol = join(RUNS_DIR, `${damga}.json`)
  writeFileSync(
    yol,
    JSON.stringify(
      {
        model: llmConfig.model,
        embeddingModel: embeddingConfig.model,
        config: DEFAULT_SCORING_CONFIG,
        totals: toplam,
        accuracy: isabetOrani,
        avgDurationMs: ortalamaSure,
        metrics,
      },
      null,
      2,
    ),
  )
  console.log(`\nSonuç yazıldı: ${yol}`)
}

void main()
