import { readFileSync, readdirSync } from "node:fs"
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
import { score, type ScoreInput } from "../src/score/score.js"
import { compareToExpectations } from "./compare.js"
import type { EvalPair } from "./types.js"

/**
 * Eşik taraması.
 *
 * Çıkarım ve gömme her çift için BİR KEZ yapılıp bellekte tutuluyor; sonra
 * skor fonksiyonu farklı eşiklerle tekrar tekrar çalıştırılıyor. Skor saf bir
 * fonksiyon olduğu için bu mümkün — her eşik için baştan çıkarım yapmak
 * dakikalarca sürerdi.
 */
const PAIRS_DIR = join(import.meta.dirname, "pairs")
const ESIKLER = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

  const dosyalar = readdirSync(PAIRS_DIR).filter((f) => f.endsWith(".json")).sort()
  const hazirlanan: Array<{ pair: EvalPair; input: ScoreInput }> = []

  console.log(`[sweep] ${dosyalar.length} çift için çıkarım yapılıyor (bir kez)…\n`)
  for (const dosya of dosyalar) {
    const pair = JSON.parse(readFileSync(join(PAIRS_DIR, dosya), "utf8")) as EvalPair
    process.stdout.write(`  ${pair.id} … `)

    const profil = await extractResumeProfile(llm, pair.resumeText)
    const ilan = await extractJobPosting(llm, pair.jobText)
    const kanitlar = collectEvidence(profil.data)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const gereksinimMetinleri = ilan.data.requirements.map((r) => r.text)
    const vektorler = await embedding.embed([...kanitMetinleri, ...gereksinimMetinleri])

    hazirlanan.push({
      pair,
      input: {
        profile: profil.data,
        posting: ilan.data,
        evidence: kanitlar,
        evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
        requirementVectors: vektorler.slice(kanitMetinleri.length),
      },
    })
    console.log(`${kanitlar.length} kanıt · ${ilan.data.requirements.length} gereksinim`)
  }

  console.log("\n[sweep] eşik taraması:\n")
  const satirlar = ESIKLER.map((esik) => {
    let hits = 0, misses = 0, fabrications = 0, byKeyword = 0, bySemantic = 0
    for (const { pair, input } of hazirlanan) {
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
    const skorlar = hazirlanan.map(({ pair, input }) => {
      const s = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: esik })
      return `${pair.id}=${s.score}`
    })
    console.log(`  ${esik.toFixed(2)} → ${skorlar.join("  ")}`)
  }
}

void main()
