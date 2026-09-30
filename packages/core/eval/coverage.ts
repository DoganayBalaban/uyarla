import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "../src/score/config.js"
import type { Evidence } from "../src/score/evidence.js"
import { collectEvidence } from "../src/score/evidence.js"
import { type ScoreInput, conceptTexts, score } from "../src/score/score.js"
import { compareToExpectations } from "./compare.js"
import { cacheDir, type EvalPair } from "./types.js"

/**
 * Kapsam taraması: anlamsal katmanın ve kanıt türlerinin daraltılmasını ölçer.
 *
 * `eval:sweep` eşiği tarıyor, bu betik **kapsamı** tarıyor. İkisinin ayrı
 * olmasının sebebi K-24: eşik taraması kalan üç uydurmayı çözemeyeceğini
 * gösterdi, çünkü sorun benzerlik değerinde değil — uydurmaların benzerliği
 * (0,6687–0,7056) meşru eşleşmelerin bandının (0,6694–0,8972) tam içinde.
 * Ayrım eşikle değil, gereksinimin ve kanıtın TÜRÜYLE kurulabilir.
 *
 * `eval:prepare` önbelleğinden okuyor ve gömmeyi bir kez yapıyor; skor saf bir
 * fonksiyon olduğu için her varyant saniyeler sürüyor.
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = join(KOK, "pairs")

const HEPSI: readonly Evidence["kind"][] = ["role", "bullet", "skill", "education"]
const PROZA: readonly Evidence["kind"][] = ["role", "bullet"]

/** Ölçülen varyantlar. Sıra rapor sırasıdır; ilki taban çizgisi. */
const VARYANTLAR: Array<{ name: string; cfg: ScoringConfig }> = [
  {
    name: "taban (kısıt yok)",
    cfg: {
      ...DEFAULT_SCORING_CONFIG,
      evidenceKindsByType: {
        skill: HEPSI,
        experience: HEPSI,
        education: HEPSI,
        soft: HEPSI,
      },
    },
  },
  {
    // Birikmiş işler #1.
    name: "#1 experience → proza",
    cfg: {
      ...DEFAULT_SCORING_CONFIG,
      evidenceKindsByType: {
        skill: HEPSI,
        experience: PROZA,
        education: HEPSI,
        soft: HEPSI,
      },
    },
  },
  {
    // Birikmiş işler #7.
    name: "#7 anlamsal yalnız soft",
    cfg: {
      ...DEFAULT_SCORING_CONFIG,
      semanticTypes: ["soft"],
      evidenceKindsByType: {
        skill: HEPSI,
        experience: HEPSI,
        education: HEPSI,
        soft: HEPSI,
      },
    },
  },
  {
    // Üçüncü fikir: anlamsal katman yalnızca anlatı kanıtına baksın. Beceri
    // satırı kanonik bir terimdir; ya lafzen eşleşir ya da benzerliği
    // sözlüksel gürültüdür.
    name: "3. fikir: her tür → proza",
    cfg: {
      ...DEFAULT_SCORING_CONFIG,
      evidenceKindsByType: {
        skill: PROZA,
        experience: PROZA,
        education: PROZA,
        soft: PROZA,
      },
    },
  },
  {
    // Dördüncü fikir: eğitim gereksinimini yalnızca diploma kanıtı karşılasın.
    name: "4. fikir: education → diploma",
    cfg: {
      ...DEFAULT_SCORING_CONFIG,
      evidenceKindsByType: {
        skill: HEPSI,
        experience: PROZA,
        education: ["education"],
        soft: HEPSI,
      },
    },
  },
  {
    name: "öntanımlı (yürürlükteki)",
    cfg: DEFAULT_SCORING_CONFIG,
  },
]

async function main() {
  const expectationFiles = existsSync(PAIRS)
    ? readdirSync(PAIRS).filter((f) => f.endsWith(".json"))
    : []
  if (expectationFiles.length === 0) {
    console.error(`[kapsam] ${PAIRS} altında beklenti dosyası yok.`)
    process.exit(1)
  }

  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const ready: Array<{ pair: EvalPair; input: ScoreInput }> = []

  for (const file of expectationFiles.sort()) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair
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

  console.log(`[kapsam] ${ready.length} çift · ${VARYANTLAR.length} varyant\n`)

  const rows = VARYANTLAR.map(({ name, cfg }) => {
    let hits = 0
    let misses = 0
    let fabrications = 0
    let byKeyword = 0
    let bySemantic = 0
    for (const { pair, input } of ready) {
      const m = compareToExpectations(pair.id, score(input, cfg), pair.expectations, 0)
      hits += m.hits
      misses += m.misses
      fabrications += m.fabrications
      byKeyword += m.byKeyword
      bySemantic += m.bySemantic
    }
    const check = hits + misses + fabrications
    return {
      varyant: name,
      "isabet %": check === 0 ? 0 : Math.round((hits / check) * 1000) / 10,
      isabet: hits,
      kaçırma: misses,
      uydurma: fabrications,
      kelime: byKeyword,
      anlamsal: bySemantic,
    }
  })
  console.table(rows)

  console.log("\nSkorlar varyanta göre:")
  for (const { name, cfg } of VARYANTLAR) {
    const scores = ready.map(
      ({ pair, input }) => `${pair.id.slice(0, 12)}=${String(score(input, cfg).score).padStart(2)}`,
    )
    console.log(`  ${name.padEnd(26)} → ${scores.join("  ")}`)
  }
}

void main()
