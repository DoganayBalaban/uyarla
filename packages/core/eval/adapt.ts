import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildAdaptationDraft, type Discard } from "../src/adapt/draft.js"
import { rescore } from "../src/adapt/rescore.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import {
  llmConfigFromEnv,
  type ExtractOptions,
  type ExtractResult,
  type LlmProvider,
} from "../src/llm/types.js"
import { resumeLanguage } from "../src/normalize/language.js"
import type { AdaptationDraft } from "../src/schemas/adaptation.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { cacheDir as cacheDir, type AdaptMetrics, type EvalPair } from "./types.js"

/**
 * Uyarlama değerlendirme koşusu (spec §12).
 *
 * Taslak üründeki `buildAdaptationDraft` ile üretiliyor: hedef seçimi,
 * yazım, terim uyumu doğrulaması, bilgi kaybı kontrolü ve atma kuralları
 * worker hattıyla birebir aynı. Önceki sürüm yazımları kendi yolundan
 * geçiriyordu ve ürünün attığı yazımları kabul sayıyordu (K-38).
 *
 * Ölçtüğü şeyler:
 *   1. Kaç madde yazıldı, kaçı önerildi, kaçı hangi kuralla atıldı
 *   2. Skor, iki okumayla:
 *      · madde — yalnızca önerilen maddeler onaylanırsa
 *      · tam   — maddeler, özet ve maddelerden eklenen beceriler
 *
 * Model yanıtları `cache/yazim-<çift>.json`'a istek özetine göre yazılıyor;
 * kural değiştiğinde ölçüm LLM'i tekrar çalıştırmadan tekrarlanabiliyor.
 * Hedef seçimi değişirse istek de değişir ve yalnızca o maddeler yeniden
 * yazılır.
 *
 * Kullanım:
 *   pnpm eval:adapt              önbellekten ölç, eksik yanıtları üret
 *   pnpm eval:adapt --refresh    bütün yanıtları yenile
 *   pnpm eval:adapt --ayrinti    atılan her yazımı gerekçesiyle göster
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

/** Yanıtları istek özetine göre saklayan sağlayıcı. */
class CachingLlm implements LlmProvider {
  private readonly record: Record<string, ExtractResult<unknown>>
  newCalls = 0

  constructor(
    private readonly inner: LlmProvider,
    private readonly filePath: string,
    refresh: boolean,
  ) {
    this.record =
      !refresh && existsSync(filePath)
        ? (JSON.parse(readFileSync(filePath, "utf8")) as Record<string, ExtractResult<unknown>>)
        : {}
  }

  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    const key = createHash("sha256")
      .update(`${opts.schemaName}\n${opts.prompt}\n${opts.input}`)
      .digest("hex")
    const stored = this.record[key]
    if (stored) return stored as ExtractResult<T>
    const outcome = await this.inner.extract<T>(opts)
    this.record[key] = outcome
    this.newCalls++
    return outcome
  }

  save() {
    if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.record, null, 2))
  }
}

async function main() {
  const refresh = process.argv.includes("--refresh")
  const verbose = process.argv.includes("--ayrinti")
  const llmConfig = llmConfigFromEnv()
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

  const files = readdirSync(PAIRS)
    .filter((f) => f.endsWith(".json"))
    .sort()
  console.log(
    `[eval:adapt] ${files.length} çift · model: ${llmConfig.model}` +
      `${refresh ? " · yanıtlar yenileniyor" : ""}\n`,
  )

  const metrics: AdaptMetrics[] = []

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
    const vectors = await embedding.embed([...evidenceTexts, ...conceptTexts(postingDataItem)])
    const outcome = score({
      profile: resumeProfile,
      posting: postingDataItem,
      evidence: evidenceList,
      evidenceVectors: vectors.slice(0, evidenceTexts.length),
      conceptVectors: vectors.slice(evidenceTexts.length),
    })

    const llm = new CachingLlm(
      new LmStudioProvider(llmConfig),
      join(CACHE, `yazim-${pair.id}.json`),
      refresh,
    )
    const discardsByReason: Record<string, number> = {}
    const discardedList: Discard[] = []
    const { draft } = await buildAdaptationDraft({
      llm,
      embedding,
      profile: resumeProfile,
      posting: postingDataItem,
      result: outcome,
      onDiscard: (d) => {
        discardedList.push(d)
        if (d.id !== "summary") discardsByReason[d.reason] = (discardsByReason[d.reason] ?? 0) + 1
      },
    })
    llm.save()

    const proposed = draft.bullets.filter((b) => b.decision === "pending")
    // Kullanıcı önerilen her maddeyi onaylamış varsayılıyor: üst sınır bu,
    // ama her önerilen yazım doğrulamayı geçmiş olduğu için dürüst bir üst
    // sınır.
    const approved: AdaptationDraft = {
      ...draft,
      bullets: draft.bullets.map((b) =>
        b.decision === "pending" ? { ...b, decision: "accepted" } : b,
      ),
    }
    const bulletsOnly: AdaptationDraft = {
      ...approved,
      summary: { ...approved.summary, decision: "rejected" },
      skillOrder: resumeProfile.skills,
      addedSkills: [],
    }

    const m: AdaptMetrics = {
      id: pair.id,
      bulletCount: draft.bullets.length,
      sameLanguage: resumeLanguage(resumeProfile) === postingDataItem.language,
      rewrittenCount: proposed.length + Object.values(discardsByReason).reduce((t, n) => t + n, 0),
      proposedCount: proposed.length,
      discarded: discardsByReason,
      summaryAccepted:
        !!resumeProfile.summary &&
        draft.summary.decision === "accepted" &&
        draft.summary.rewritten !== resumeProfile.summary,
      addedSkills: draft.addedSkills ?? [],
      discards: discardedList.map((d) => ({
        ...d,
        original: d.id === "summary" ? (resumeProfile.summary ?? "") : (draft.bullets.find((b) => b.id === d.id)?.original ?? ""),
      })),
      scoreBefore: outcome.score,
      scoreBullets: await rescore({ profile: resumeProfile, posting: postingDataItem, draft: bulletsOnly }, embedding),
      scoreFull: await rescore({ profile: resumeProfile, posting: postingDataItem, draft: approved }, embedding),
      durationMs: Date.now() - startedAt,
    }
    metrics.push(m)

    const discardedText = Object.entries(discardsByReason)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")
    console.log(
      `  ${pair.id.padEnd(16)} ${String(m.bulletCount).padStart(2)} madde · ` +
        (m.sameLanguage ? "" : "dil farklı · ") +
        `önerilen ${m.proposedCount}/${m.rewrittenCount}` +
        (discardedText ? ` (atılan: ${discardedText})` : "") +
        ` · özet ${m.summaryAccepted ? "✓" : "–"}` +
        ` · +${m.addedSkills.length} beceri` +
        ` · skor ${m.scoreBefore} → madde ${m.scoreBullets} → tam ${m.scoreFull}` +
        (llm.newCalls ? ` · yeni çağrı ${llm.newCalls}` : ""),
    )
    for (const d of m.discards) {
      console.log(`      ✗ ${d.id} ${d.reason}: ${d.detail}`)
      if (verbose) {
        console.log(`          önce : ${d.original}`)
        console.log(`          sonra: ${d.rewritten}`)
      }
    }
  }

  const sum = (f: (m: AdaptMetrics) => number) => metrics.reduce((t, m) => t + f(m), 0)
  const avg = (f: (m: AdaptMetrics) => number) => sum(f) / metrics.length
  const mark = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`
  const kinds: Record<string, number> = {}
  for (const m of metrics) {
    for (const [k, v] of Object.entries(m.discarded)) kinds[k] = (kinds[k] ?? 0) + v
  }
  const written = sum((m) => m.rewrittenCount)
  const proposed = sum((m) => m.proposedCount)

  console.log(`\n  toplam madde          : ${sum((m) => m.bulletCount)}`)
  console.log(`  hedefle yazılan       : ${written}`)
  console.log(
    `  önerilen              : ${proposed}` +
      (written ? ` (%${((proposed / written) * 100).toFixed(0)})` : ""),
  )
  console.log(`  atılan (nedene göre)  : ${JSON.stringify(kinds)}`)
  console.log(`  özet kabul            : ${sum((m) => (m.summaryAccepted ? 1 : 0))}/${metrics.length}`)
  console.log(`  eklenen beceri        : ${sum((m) => m.addedSkills.length)}`)
  console.log(`  skor değişimi (madde) : ${mark(avg((m) => m.scoreBullets - m.scoreBefore))}`)
  console.log(
    `  skor değişimi (tam)   : ${mark(avg((m) => m.scoreFull - m.scoreBefore))}` +
      `  (artan ${metrics.filter((m) => m.scoreFull > m.scoreBefore).length}, ` +
      `düşen ${metrics.filter((m) => m.scoreFull < m.scoreBefore).length})`,
  )

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const output = join(RUNS, `uyarla-${timestamp}.json`)
  writeFileSync(
    output,
    JSON.stringify({ model: llmConfig.model, metrics, discardsByReason: kinds }, null, 2),
  )
  console.log(`\n  → runs/uyarla-${timestamp}.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
