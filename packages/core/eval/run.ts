import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { DEFAULT_SCORING_CONFIG } from "../src/score/config.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { compareToExpectations } from "./compare.js"
import { cacheDir as cacheDir, type EvalPair, type EvalTotals, type PairMetrics } from "./types.js"

/**
 * Değerlendirme koşusu: eşleştirme isabetini ölçer.
 *
 * Çıkarım `eval:prepare` önbelleğinden okunuyor; bu betik yalnızca skorlamayı
 * ve karşılaştırmayı yapıyor. Böylece skor kuralı değiştiğinde ölçüm saniyeler
 * içinde tekrarlanabiliyor.
 *
 * Ölçülen şey skor rakamı değil isabet: skor bundan türeyen bir sayı, kalite
 * sinyali eşleştirmenin kendisinde (spec §10).
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

async function main() {
  if (!existsSync(PAIRS) || readdirSync(PAIRS).filter((f) => f.endsWith(".json")).length === 0) {
    console.error(
      `[eval] ${PAIRS} altında beklenti dosyası yok.\n` +
        "Önce 'pnpm eval:prepare' çalıştırıp inceleme.md üzerinden beklentileri yaz.",
    )
    process.exit(1)
  }

  const llmConfig = llmConfigFromEnv()
  const embeddingConfig = embeddingConfigFromEnv()
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfig)

  const files = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort()
  console.log(`[eval] ${files.length} çift · model: ${llmConfig.model}\n`)

  const metrics: PairMetrics[] = []
  for (const file of files) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair
    const startedAt = Date.now()

    const resumeProfile = JSON.parse(
      readFileSync(join(CACHE, `cv-${pair.resumeId}.json`), "utf8"),
    ) as ResumeProfile
    const postingDataItem = JSON.parse(
      readFileSync(join(CACHE, `ilan-${pair.postingId}.json`), "utf8"),
    ) as JobPostingData

    const evidenceList = collectEvidence(resumeProfile)
    const evidenceTexts = evidenceList.map((k) => k.text)
    const conceptTextList = conceptTexts(postingDataItem)
    const vectors = await embedding.embed([...evidenceTexts, ...conceptTextList])

    const outcome = score({
      profile: resumeProfile,
      posting: postingDataItem,
      evidence: evidenceList,
      evidenceVectors: vectors.slice(0, evidenceTexts.length),
      conceptVectors: vectors.slice(evidenceTexts.length),
    })

    const m = compareToExpectations(pair.id, outcome, pair.expectations, Date.now() - startedAt)
    metrics.push(m)
    console.log(
      `  ${pair.id.padEnd(30)} skor ${String(m.score).padStart(3)} · ` +
        `isabet ${m.hits} · kaçırma ${m.misses} · uydurma ${m.fabrications}` +
        (m.notExtracted ? ` · çıkarılmayan ${m.notExtracted}` : ""),
    )
  }

  console.table(
    metrics.map((m) => ({
      çift: m.id, skor: m.score, isabet: m.hits, kaçırma: m.misses,
      uydurma: m.fabrications, çıkarılmayan: m.notExtracted,
      kelime: m.byKeyword, anlamsal: m.bySemantic,
    })),
  )

  const total: EvalTotals = metrics.reduce(
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
  const check = total.hits + total.misses + total.fabrications
  const accuracyRate = check === 0 ? 0 : total.hits / check

  console.log("\n--- Toplam ---")
  console.log(`İsabet oranı   : ${(accuracyRate * 100).toFixed(1)}%`)
  console.log(`Kaçırma        : ${total.misses}`)
  console.log(`Uydurma        : ${total.fabrications}   <- en zararlısı`)
  console.log(`Çıkarılmayan   : ${total.notExtracted}   <- ilan çıkarımı sorunu`)
  console.log(`Eşleşme kaynağı: kelime ${total.byKeyword} · anlamsal ${total.bySemantic}`)
  console.log(`Model          : ${llmConfig.model} · embedding: ${embeddingConfig.model}`)
  console.log(`Eşik / ağırlık : ${JSON.stringify(DEFAULT_SCORING_CONFIG)}`)

  mkdirSync(RUNS, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  writeFileSync(
    join(RUNS, `${timestamp}.json`),
    JSON.stringify(
      { model: llmConfig.model, config: DEFAULT_SCORING_CONFIG, totals: total, accuracy: accuracyRate, metrics },
      null, 2,
    ),
  )
  console.log(`\nSonuç yazıldı: runs/${timestamp}.json`)
}

void main()
