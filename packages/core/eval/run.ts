import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import { resumeLanguage } from "../src/normalize/language.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { DEFAULT_SCORING_CONFIG } from "../src/score/config.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { scoreStatus } from "../../../apps/web/src/lib/scoreStatus.js"
import { compareToExpectations } from "./compare.js"
import { cacheDir, type EvalPair, type EvalTotals, type PairMetrics } from "./types.js"

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
    const conceptTextList = conceptTexts(postingDataItem, resumeLanguage(resumeProfile))
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

  // Etiket isabeti (DOG-103): ekrandaki etiket, çiftin beklenen seviyesiyle
  // aynı mı. Eşikler web'de (scoreStatus); bağımlılığı olmayan bir modül,
  // buradan doğrudan okunuyor ki ölçülen eşik ekrandakinin kendisi olsun.
  const levels = expectedLevels()
  const LABEL_LEVEL: Record<string, string> = { "Yüksek uyum": "yüksek", "Orta uyum": "orta", "Düşük uyum": "düşük" }
  const labelRows = metrics
    .filter((m) => levels.has(m.id))
    .map((m) => ({ id: m.id, expected: levels.get(m.id)!, got: LABEL_LEVEL[scoreStatus(m.score).label]!, score: m.score }))
  const labelHits = labelRows.filter((r) => r.expected === r.got).length

  console.log("\n--- Toplam ---")
  console.log(`İsabet oranı   : ${(accuracyRate * 100).toFixed(1)}%`)
  console.log(`Kaçırma        : ${total.misses}`)
  console.log(`Uydurma        : ${total.fabrications}   <- en zararlısı`)
  console.log(`Çıkarılmayan   : ${total.notExtracted}   <- ilan çıkarımı sorunu`)
  console.log(`Etiket isabeti : ${labelHits}/${labelRows.length}`)
  for (const r of labelRows.filter((x) => x.expected !== x.got)) {
    console.log(`  ✗ ${r.id}: skor ${r.score} → ${r.got}, beklenen ${r.expected}`)
  }
  console.log(`Eşleşme kaynağı: kelime ${total.byKeyword} · anlamsal ${total.bySemantic}`)
  console.log(`Model          : ${llmConfig.model} · embedding: ${embeddingConfig.model}`)
  console.log(`Eşik / ağırlık : ${JSON.stringify(DEFAULT_SCORING_CONFIG)}`)

  mkdirSync(RUNS, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  writeFileSync(
    join(RUNS, `${timestamp}.json`),
    JSON.stringify(
      {
        model: llmConfig.model,
        config: DEFAULT_SCORING_CONFIG,
        totals: total,
        accuracy: accuracyRate,
        labels: { hits: labelHits, total: labelRows.length },
        metrics,
      },
      null, 2,
    ),
  )
  console.log(`\nSonuç yazıldı: runs/${timestamp}.json`)
}

/** sources/pairs.json'daki beklenen seviye, çift kimliğiyle ("cv-a__ilan-1"). */
function expectedLevels(): Map<string, string> {
  const file = JSON.parse(readFileSync(join(KOK, "sources", "pairs.json"), "utf8")) as {
    pairs: Array<{ resumeId: string; postingId: string; expectation: string }>
  }
  return new Map(
    file.pairs.map((p) => [`${p.resumeId.split("-").slice(0, 2).join("-")}__${p.postingId}`, p.expectation]),
  )
}

void main()
