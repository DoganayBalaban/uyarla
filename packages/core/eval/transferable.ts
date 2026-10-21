import { readFileSync } from "node:fs"
import { join } from "node:path"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv, type ExtractOptions, type ExtractResult, type LlmProvider } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { scoreProfile } from "../src/score/live.js"
import { findTransferable } from "../src/score/transferable.js"
import { cacheDir } from "./types.js"

/**
 * Aktarılabilir deneyim ölçümü (DOG-100). Alan değiştiren çiftler: muhasebe
 * → İK, satış → pazarlama, İK → muhasebe, test → AI. Sayılan: önerilen,
 * CV'de birebir olmadığı için düşen alıntı, sayısı işaretli gerekçe.
 * Önerilerin anlamlı olup olmadığı çıktıdan elle okunuyor.
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = [
  ["cv-e-muhasebe", "ilan-9"],
  ["cv-e-muhasebe", "ilan-11"],
  ["cv-f-satis", "ilan-6"],
  ["cv-f-satis", "ilan-8"],
  ["cv-g-ik", "ilan-7"],
  ["cv-b-test-engineer", "ilan-4"],
  ["cv-d-pazarlama", "ilan-8"],
] as const

/** Modelin ham önerilerini saymak için yanıtı yakalıyor. */
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
  const t = { missing: 0, proposed: 0, kept: 0, flagged: 0 }
  for (const [cv, ilan] of PAIRS) {
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${cv}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${ilan}.json`), "utf8")) as JobPostingData
    const scored = await scoreProfile({ profile, posting }, embedding)
    const missingMust = scored.requirements
      .map((r, index) => ({ r, index }))
      .filter(({ r }) => r.status === "missing" && r.requirement.importance === "must" && !["soft", "condition"].includes(r.requirement.type))
      .map(({ r, index }) => ({ index, text: r.requirement.text }))
    const { data } = await findTransferable(llm, { profile, posting, missingMust })
    const raw = (llm.last as { kopruler?: Array<{ alinti: string | null }> } | null)?.kopruler ?? []
    const proposed = raw.filter((k) => k.alinti).length
    const kept = data.filter((i) => i.quote)
    const flagged = kept.filter((i) => i.verification?.status === "flagged")
    Object.assign(t, { missing: t.missing + missingMust.length, proposed: t.proposed + proposed, kept: t.kept + kept.length, flagged: t.flagged + flagged.length })
    console.log(`\n${cv} × ${ilan} · eksik zorunlu ${missingMust.length} · önerilen ${proposed} · birebir ${kept.length} · işaretli ${flagged.length}`)
    for (const i of data) {
      console.log(`  - ${i.requirement.slice(0, 70)}`)
      console.log(i.quote ? `      ← "${i.quote.slice(0, 110)}"\n      ${i.reason}${i.verification?.status === "flagged" ? "  ⚠" : ""}` : "      (yakın deneyim yok)")
    }
  }
  console.log(`\nEksik zorunlu ${t.missing} · önerilen ${t.proposed} · CV'de birebir ${t.kept} · sayısı işaretli ${t.flagged}`)
}

void main()
