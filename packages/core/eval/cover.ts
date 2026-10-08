import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { generateCoverLetter, type CandidateIntent } from "../src/cover/letter.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv, type ExtractOptions, type ExtractResult, type LlmProvider } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { cacheDir, type EvalPair } from "./types.js"

/**
 * Ön yazıda amacın etkisi (DOG-55).
 *
 * Her çift için ön yazı dört kez üretiliyor: amaçsız, kariyer değiştiren,
 * ilk işini arayan ve terfi isteyen aday. Ölçülen şey uydurma kontrolünün
 * işaretlediği paragraf ve sorun sayısı: amaç satırı vurguyu değiştirmeli,
 * CV'de olmayan bir şey yazdırmamalı. Metinler `runs/onyazi-<zaman>.json`'a
 * yazılıyor; vurgunun gerçekten değişip değişmediği oradan okunuyor.
 *
 * Kullanım:
 *   pnpm eval:cover              önbellekten ölç, eksik yanıtları üret
 *   pnpm eval:cover --refresh    bütün yanıtları yenile
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

const VARIANTS: Array<{ name: string; intent: (posting: JobPostingData) => CandidateIntent | undefined }> = [
  { name: "amaçsız", intent: () => undefined },
  { name: "kariyer değişikliği", intent: (p) => ({ goal: "career_change", targetRole: p.position }) },
  { name: "ilk iş", intent: () => ({ goal: "first_job" }) },
  { name: "terfi", intent: () => ({ goal: "promotion" }) },
]

/** Yanıtları istek özetine göre saklayan sağlayıcı (eval:adapt'teki gibi). */
class CachingLlm implements LlmProvider {
  private readonly record: Record<string, ExtractResult<unknown>>

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
    const key = createHash("sha256").update(`${opts.schemaName}\n${opts.prompt}\n${opts.input}`).digest("hex")
    const stored = this.record[key]
    if (stored) return stored as ExtractResult<T>
    const outcome = await this.inner.extract<T>(opts)
    this.record[key] = outcome
    return outcome
  }

  save() {
    if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.record, null, 2))
  }
}

async function main() {
  const refresh = process.argv.includes("--refresh")
  const llmConfig = llmConfigFromEnv()
  const files = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort()
  console.log(`[eval:cover] ${files.length} çift · ${VARIANTS.length} hâl · model: ${llmConfig.model}\n`)

  const totals = new Map(VARIANTS.map((v) => [v.name, { flagged: 0, issues: 0, paragraphs: 0, words: 0 }]))
  const letters: Array<{ pair: string; variant: string; paragraphs: unknown }> = []

  for (const file of files) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${pair.resumeId}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${pair.postingId}.json`), "utf8")) as JobPostingData
    const llm = new CachingLlm(new LmStudioProvider(llmConfig), join(CACHE, `onyazi-${pair.id}.json`), refresh)

    const row: string[] = []
    for (const variant of VARIANTS) {
      const { data } = await generateCoverLetter(llm, { profile, posting, intent: variant.intent(posting) })
      const flagged = data.paragraphs.filter((p) => p.verification.status === "flagged")
      const t = totals.get(variant.name)!
      t.flagged += flagged.length
      t.issues += data.paragraphs.reduce((n, p) => n + p.verification.issues.length, 0)
      t.paragraphs += data.paragraphs.length
      t.words += data.paragraphs.reduce((n, p) => n + p.text.split(/\s+/).length, 0)
      letters.push({ pair: pair.id, variant: variant.name, paragraphs: data.paragraphs })
      row.push(`${variant.name}: ${flagged.length}/${data.paragraphs.length}`)
    }
    llm.save()
    console.log(`${pair.id.padEnd(16)} işaretli paragraf · ${row.join(" · ")}`)
  }

  console.log("\nToplam (işaretli paragraf / paragraf · sorun · ort. kelime)")
  for (const [name, t] of totals) {
    console.log(
      `  ${name.padEnd(20)} ${t.flagged}/${t.paragraphs} · ${t.issues} sorun · ${Math.round(t.words / files.length)} kelime`,
    )
  }

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const out = join(RUNS, `onyazi-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  writeFileSync(out, JSON.stringify({ model: llmConfig.model, totals: Object.fromEntries(totals), letters }, null, 2))
  console.log(`\nMetinler: ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
