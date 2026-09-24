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
import type { EvalPair } from "./types.js"

/**
 * Eşik taraması.
 *
 * Çıkarım `eval:prepare` önbelleğinden okunuyor, gömme bir kez yapılıyor;
 * sonra skor fonksiyonu farklı eşiklerle tekrar tekrar çalıştırılıyor. Skor
 * saf bir fonksiyon olduğu için bu mümkün — her eşik için baştan çıkarım
 * yapmak dakikalarca sürerdi.
 */
const KOK = import.meta.dirname
const CACHE = join(KOK, "cache")
const SOURCES = join(KOK, "sources")
const PAIRS = join(KOK, "pairs")
const ESIKLER = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]

async function main() {
  const beklentiDosyalari = existsSync(PAIRS)
    ? readdirSync(PAIRS).filter((f) => f.endsWith(".json"))
    : []
  if (beklentiDosyalari.length === 0) {
    console.error(
      `[sweep] ${PAIRS} altında beklenti dosyası yok.\n` +
        "Tarama isabet ölçebilmek için beklentilere ihtiyaç duyuyor.",
    )
    process.exit(1)
  }

  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const hazir: Array<{ pair: EvalPair; input: ScoreInput }> = []

  for (const dosya of beklentiDosyalari.sort()) {
    const pair = JSON.parse(readFileSync(join(PAIRS, dosya), "utf8")) as EvalPair & {
      cv: string
      ilan: string
    }
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

  console.log(`[sweep] ${hazir.length} çift · ${ESIKLER.length} eşik\n`)

  const satirlar = ESIKLER.map((esik) => {
    let hits = 0, misses = 0, fabrications = 0, byKeyword = 0, bySemantic = 0
    for (const { pair, input } of hazir) {
      const sonuc = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: esik })
      const m = compareToExpectations(pair.id, sonuc, pair.expectations, 0)
      hits += m.hits; misses += m.misses; fabrications += m.fabrications
      byKeyword += m.byKeyword; bySemantic += m.bySemantic
    }
    const kontrol = hits + misses + fabrications
    return {
      eşik: esik,
      isabet: hits,
      kaçırma: misses,
      uydurma: fabrications,
      "isabet %": kontrol === 0 ? 0 : Math.round((hits / kontrol) * 1000) / 10,
      kelime: byKeyword,
      anlamsal: bySemantic,
    }
  })
  console.table(satirlar)

  console.log("\nSkorlar eşiğe göre:")
  for (const esik of ESIKLER) {
    const skorlar = hazir.map(({ pair, input }) => {
      const s = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: esik })
      return `${pair.id.slice(0, 18)}=${String(s.score).padStart(2)}`
    })
    console.log(`  ${esik.toFixed(2)} → ${skorlar.join("  ")}`)
  }
}

void main()
