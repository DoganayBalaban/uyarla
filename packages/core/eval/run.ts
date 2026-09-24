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
import type { EvalPair, EvalTotals, PairMetrics } from "./types.js"

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
const CACHE = join(KOK, "cache")
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

  const dosyalar = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort()
  console.log(`[eval] ${dosyalar.length} çift · model: ${llmConfig.model}\n`)

  const metrics: PairMetrics[] = []
  for (const dosya of dosyalar) {
    const pair = JSON.parse(readFileSync(join(PAIRS, dosya), "utf8")) as EvalPair
    const basladi = Date.now()

    const profil = JSON.parse(
      readFileSync(join(CACHE, `cv-${pair.cv}.json`), "utf8"),
    ) as ResumeProfile
    const ilan = JSON.parse(
      readFileSync(join(CACHE, `ilan-${pair.ilan}.json`), "utf8"),
    ) as JobPostingData

    const kanitlar = collectEvidence(profil)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const kavramMetinleri = conceptTexts(ilan)
    const vektorler = await embedding.embed([...kanitMetinleri, ...kavramMetinleri])

    const sonuc = score({
      profile: profil,
      posting: ilan,
      evidence: kanitlar,
      evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
      conceptVectors: vektorler.slice(kanitMetinleri.length),
    })

    const m = compareToExpectations(pair.id, sonuc, pair.expectations, Date.now() - basladi)
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
  const kontrol = toplam.hits + toplam.misses + toplam.fabrications
  const isabet = kontrol === 0 ? 0 : toplam.hits / kontrol

  console.log("\n--- Toplam ---")
  console.log(`İsabet oranı   : ${(isabet * 100).toFixed(1)}%`)
  console.log(`Kaçırma        : ${toplam.misses}`)
  console.log(`Uydurma        : ${toplam.fabrications}   <- en zararlısı`)
  console.log(`Çıkarılmayan   : ${toplam.notExtracted}   <- ilan çıkarımı sorunu`)
  console.log(`Eşleşme kaynağı: kelime ${toplam.byKeyword} · anlamsal ${toplam.bySemantic}`)
  console.log(`Model          : ${llmConfig.model} · embedding: ${embeddingConfig.model}`)
  console.log(`Eşik / ağırlık : ${JSON.stringify(DEFAULT_SCORING_CONFIG)}`)

  mkdirSync(RUNS, { recursive: true })
  const damga = new Date().toISOString().replace(/[:.]/g, "-")
  writeFileSync(
    join(RUNS, `${damga}.json`),
    JSON.stringify(
      { model: llmConfig.model, config: DEFAULT_SCORING_CONFIG, totals: toplam, accuracy: isabet, metrics },
      null, 2,
    ),
  )
  console.log(`\nSonuç yazıldı: runs/${damga}.json`)
}

void main()
