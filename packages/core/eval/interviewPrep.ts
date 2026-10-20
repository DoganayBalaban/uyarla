import { readFileSync } from "node:fs"
import { join } from "node:path"
import { generateInterviewPrep } from "../src/interview/prep.js"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv, type ExtractOptions, type ExtractResult, type LlmProvider } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { scoreProfile } from "../src/score/live.js"
import { cacheDir } from "./types.js"

/**
 * Mülakat hazırlık paketi (DOG-118).
 *
 * Altı farklı alandan çift (yazılım, test, pazarlama, muhasebe, satış, İK).
 * Eksik zorunlu gereksinimler skorlamadan. Ölçülenler:
 *   - Kanıt: modelin önerdiği maddelerin kaçı CV'de birebir (kalan), kaçı
 *     düşürüldü (CV'de yok ya da değiştirilmiş).
 *   - STAR ve köprü cevaplarında uydurma işareti.
 *   - Her eksik zorunlu gereksinim için köprü yazıldı mı.
 *   - Kanıtsız STAR'da yer tutucu var mı (yoksa uydurma riski).
 *
 * Kullanım: pnpm eval:interview-prep
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = [
  ["cv-a-ai-engineer", "ilan-2"],
  ["cv-b-test-engineer", "ilan-10"],
  ["cv-d-pazarlama", "ilan-6"],
  ["cv-e-muhasebe", "ilan-11"],
  ["cv-f-satis", "ilan-8"],
  ["cv-g-ik", "ilan-7"],
] as const

/** Modelin ham kanıt önerilerini saymak için yanıtı yakalıyor. */
class Recording implements LlmProvider {
  last: unknown = null
  constructor(private readonly inner: LlmProvider) {}
  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    const r = await this.inner.extract<T>(opts)
    this.last = r.data
    return r
  }
}

async function main() {
  const llm = new Recording(new LmStudioProvider(llmConfigFromEnv()))
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const t = { questions: 0, proposed: 0, kept: 0, starFlagged: 0, bridges: 0, missing: 0, bridgeFlagged: 0, bareStar: 0 }

  for (const [cv, ilan] of PAIRS) {
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${cv}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${ilan}.json`), "utf8")) as JobPostingData
    const scored = await scoreProfile({ profile, posting }, embedding)
    const missingMust = scored.requirements
      .filter((r) => r.status === "missing" && r.requirement.importance === "must" && !["soft", "condition"].includes(r.requirement.type))
      .map((r) => r.requirement.text)

    const { data } = await generateInterviewPrep(llm, { profile, posting, missingMust })
    const raw = llm.last as { sorular: Array<{ kanit: string[] }> }
    const proposed = raw.sorular.reduce((n, q) => n + q.kanit.length, 0)
    const kept = data.questions.reduce((n, q) => n + q.evidence.length, 0)
    const starFlagged = data.questions.filter((q) => q.verification.status === "flagged")
    // Kanıtı olmayan sorunun STAR'ı yer tutucu taşımalı.
    const bare = data.questions.filter((q) => q.evidence.length === 0 && !/\[[^\]]+\]/.test(Object.values(q.star).join(" ")))
    const bridgeFlagged = data.bridges.filter((b) => b.verification.status === "flagged")
    Object.assign(t, {
      questions: t.questions + data.questions.length,
      proposed: t.proposed + proposed,
      kept: t.kept + kept,
      starFlagged: t.starFlagged + starFlagged.length,
      bridges: t.bridges + data.bridges.length,
      missing: t.missing + missingMust.length,
      bridgeFlagged: t.bridgeFlagged + bridgeFlagged.length,
      bareStar: t.bareStar + bare.length,
    })
    console.log(
      `${`${cv}×${ilan}`.padEnd(28)} soru ${data.questions.length} (${data.questions.map((q) => q.kind[0]).join("")}) · kanıt ${kept}/${proposed} · STAR⚠ ${starFlagged.length} · köprü ${data.bridges.length}/${missingMust.length} (⚠ ${bridgeFlagged.length}) · tutarlılık ${data.consistency.length}`,
    )
    for (const q of starFlagged) console.log(`   STAR⚠ ${q.question} → ${q.verification.issues.map((i) => i.detail).join(" | ")}`)
    for (const b of bridgeFlagged) console.log(`   köprü⚠ ${b.answer}`)
    if (cv === "cv-e-muhasebe") {
      console.log(JSON.stringify({ ...data, questions: data.questions.slice(0, 3) }, null, 2))
    }
  }
  console.log(
    `\nSoru ${t.questions} · kanıt ${t.kept}/${t.proposed} kaldı · STAR uydurma ${t.starFlagged} · kanıtsız ve yer tutucusuz STAR ${t.bareStar} · köprü ${t.bridges}/${t.missing} (uydurma ${t.bridgeFlagged})`,
  )
}

void main()
