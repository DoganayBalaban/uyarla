import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { DEFAULT_SCORING_CONFIG } from "../src/score/config.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score, type ScoreInput } from "../src/score/score.js"
import { compareToExpectations } from "./compare.js"
import { cacheDir as cacheDir, type EvalPair } from "./types.js"

/**
 * Eşik taraması.
 *
 * Çıkarım `eval:prepare` önbelleğinden okunuyor, gömme bir kez yapılıyor;
 * sonra skor fonksiyonu farklı eşiklerle tekrar tekrar çalıştırılıyor. Skor
 * saf bir fonksiyon olduğu için bu mümkün — her eşik için baştan çıkarım
 * yapmak dakikalarca sürerdi.
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const SOURCES = join(KOK, "sources")
const PAIRS = join(KOK, "pairs")
const ESIKLER = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]

async function main() {
  const expectationFiles = existsSync(PAIRS)
    ? readdirSync(PAIRS).filter((f) => f.endsWith(".json"))
    : []
  if (expectationFiles.length === 0) {
    console.error(
      `[sweep] ${PAIRS} altında beklenti dosyası yok.\n` +
        "Tarama isabet ölçebilmek için beklentilere ihtiyaç duyuyor.",
    )
    process.exit(1)
  }

  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const ready: Array<{ pair: EvalPair; input: ScoreInput }> = []

  for (const file of expectationFiles.sort()) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair & {
      resumeId: string
      posting: string
    }
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

    ready.push({
      pair,
      input: {
        profile: resumeProfile,
        posting: postingDataItem,
        evidence: evidenceList,
        evidenceVectors: vectors.slice(0, evidenceTexts.length),
        conceptVectors: vectors.slice(evidenceTexts.length),
      },
    })
  }

  console.log(`[sweep] ${ready.length} çift · ${ESIKLER.length} eşik\n`)

  const rows = ESIKLER.map((threshold) => {
    let hits = 0, misses = 0, fabrications = 0, byKeyword = 0, bySemantic = 0
    for (const { pair, input } of ready) {
      const outcome = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: threshold })
      const m = compareToExpectations(pair.id, outcome, pair.expectations, 0)
      hits += m.hits; misses += m.misses; fabrications += m.fabrications
      byKeyword += m.byKeyword; bySemantic += m.bySemantic
    }
    const check = hits + misses + fabrications
    return {
      eşik: threshold,
      isabet: hits,
      kaçırma: misses,
      uydurma: fabrications,
      "isabet %": check === 0 ? 0 : Math.round((hits / check) * 1000) / 10,
      kelime: byKeyword,
      anlamsal: bySemantic,
    }
  })
  console.table(rows)

  console.log("\nSkorlar eşiğe göre:")
  for (const threshold of ESIKLER) {
    const scores = ready.map(({ pair, input }) => {
      const s = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: threshold })
      return `${pair.id.slice(0, 18)}=${String(s.score).padStart(2)}`
    })
    console.log(`  ${threshold.toFixed(2)} → ${scores.join("  ")}`)
  }
}

void main()
