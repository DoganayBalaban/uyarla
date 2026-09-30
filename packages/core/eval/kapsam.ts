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
import { onbellekDizini, type EvalPair } from "./types.js"

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
const CACHE = onbellekDizini(KOK)
const PAIRS = join(KOK, "pairs")

const HEPSI: readonly Evidence["kind"][] = ["role", "bullet", "skill", "education"]
const PROZA: readonly Evidence["kind"][] = ["role", "bullet"]

/** Ölçülen varyantlar. Sıra rapor sırasıdır; ilki taban çizgisi. */
const VARYANTLAR: Array<{ ad: string; cfg: ScoringConfig }> = [
  {
    ad: "taban (kısıt yok)",
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
    ad: "#1 experience → proza",
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
    ad: "#7 anlamsal yalnız soft",
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
    ad: "3. fikir: her tür → proza",
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
    ad: "4. fikir: education → diploma",
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
    ad: "öntanımlı (yürürlükteki)",
    cfg: DEFAULT_SCORING_CONFIG,
  },
]

async function main() {
  const beklentiDosyalari = existsSync(PAIRS)
    ? readdirSync(PAIRS).filter((f) => f.endsWith(".json"))
    : []
  if (beklentiDosyalari.length === 0) {
    console.error(`[kapsam] ${PAIRS} altında beklenti dosyası yok.`)
    process.exit(1)
  }

  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const hazir: Array<{ pair: EvalPair; input: ScoreInput }> = []

  for (const dosya of beklentiDosyalari.sort()) {
    const pair = JSON.parse(readFileSync(join(PAIRS, dosya), "utf8")) as EvalPair
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

    hazir.push({
      pair,
      input: {
        profile: profil,
        posting: ilan,
        evidence: kanitlar,
        evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
        conceptVectors: vektorler.slice(kanitMetinleri.length),
      },
    })
  }

  console.log(`[kapsam] ${hazir.length} çift · ${VARYANTLAR.length} varyant\n`)

  const satirlar = VARYANTLAR.map(({ ad, cfg }) => {
    let hits = 0
    let misses = 0
    let fabrications = 0
    let byKeyword = 0
    let bySemantic = 0
    for (const { pair, input } of hazir) {
      const m = compareToExpectations(pair.id, score(input, cfg), pair.expectations, 0)
      hits += m.hits
      misses += m.misses
      fabrications += m.fabrications
      byKeyword += m.byKeyword
      bySemantic += m.bySemantic
    }
    const kontrol = hits + misses + fabrications
    return {
      varyant: ad,
      "isabet %": kontrol === 0 ? 0 : Math.round((hits / kontrol) * 1000) / 10,
      isabet: hits,
      kaçırma: misses,
      uydurma: fabrications,
      kelime: byKeyword,
      anlamsal: bySemantic,
    }
  })
  console.table(satirlar)

  console.log("\nSkorlar varyanta göre:")
  for (const { ad, cfg } of VARYANTLAR) {
    const skorlar = hazir.map(
      ({ pair, input }) => `${pair.id.slice(0, 12)}=${String(score(input, cfg).score).padStart(2)}`,
    )
    console.log(`  ${ad.padEnd(26)} → ${skorlar.join("  ")}`)
  }
}

void main()
