import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { extractJobPosting } from "../src/extract/job.js"
import { extractResumeProfile } from "../src/extract/resume.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import {
  type ExtractOptions,
  type ExtractResult,
  type LlmProvider,
  llmConfigFromEnv,
} from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { cacheDir } from "./types.js"

/**
 * Değerlendirme çiftlerini hazırlar ve incelenebilir bir rapor üretir.
 *
 * Çıkarım sonuçları `eval/cache/` altına yazılıyor ve varsa yeniden
 * kullanılıyor. Sebebi pratik: skor kuralları, eşikler ve normalleştirme sık
 * değişiyor ve her değişiklikte LLM'i baştan çalıştırmak on beş dakika
 * sürüyordu. Önbellekle saniyeler sürüyor.
 *
 * Çıkarımın kendisi değiştiğinde (prompt, şema, model) önbellek geçersizdir:
 *   pnpm eval:prepare --refresh
 */
const KOK = import.meta.dirname
const SOURCES = join(KOK, "sources")
const CACHE = cacheDir(KOK)
const RAPOR = join(KOK, "inceleme.md")

interface PairConfig {
  resumeId: string
  postingId: string
  expectation: string
}

async function main() {
  const refresh = process.argv.includes("--refresh")
  const llm = new CountingLlm(new LmStudioProvider(llmConfigFromEnv()))
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  mkdirSync(CACHE, { recursive: true })

  const { pairs } = JSON.parse(
    readFileSync(join(SOURCES, "pairs.json"), "utf8"),
  ) as { pairs: PairConfig[] }

  const resumeIds = [...new Set(pairs.map((p) => p.resumeId))]
  const postingIds = [...new Set(pairs.map((p) => p.postingId))]

  const profiles = new Map<string, ResumeProfile>()
  for (const id of resumeIds) {
    profiles.set(
      id,
      await cachedOrRun(`cv-${id}`, refresh, async () => {
        const rawText = readFileSync(join(SOURCES, "cv", `${id}.txt`), "utf8")
        return (await extractResumeProfile(llm, rawText)).data
      }, llm),
    )
  }

  const postingData = new Map<string, JobPostingData>()
  for (const id of postingIds) {
    postingData.set(
      id,
      await cachedOrRun(`ilan-${id}`, refresh, async () => {
        const rawText = readFileSync(join(SOURCES, "ilan", `${id}.txt`), "utf8")
        return (await extractJobPosting(llm, rawText)).data
      }, llm),
    )
  }

  const rows: string[] = [
    "# Değerlendirme çiftleri · inceleme",
    "",
    "Her gereksinim için sistemin kararı ve gösterdiği kanıt aşağıda.",
    "Beklenti dosyalarını yazmadan önce bu liste elle gözden geçirilmeli:",
    "**sistemin kaçırdığı** ve **uydurduğu** eşleşmeler işaretlenmeli.",
    "",
  ]

  for (const pairItem of pairs) {
    const resumeProfile = profiles.get(pairItem.resumeId)!
    const postingDataItem = postingData.get(pairItem.postingId)!

    const evidenceList = collectEvidence(resumeProfile)
    const evidenceTexts = evidenceList.map((k) => k.text)
    const conceptTextList = conceptTexts(postingDataItem)
    const vectors = await embedding.embed([...evidenceTexts, ...conceptTextList])

    const outcome = score({
      profile: resumeProfile,
      posting: postingDataItem,
      evidence: evidenceList,
      evidenceVectors: vectors.slice(0, evidenceTexts.length),
      conceptVectors: vectors.slice(evidenceTexts.length),
    })

    rows.push(
      `## ${pairItem.resumeId} × ${pairItem.postingId}`,
      "",
      `**Skor ${outcome.score}** · beklenti: ${pairItem.expectation} · ${postingDataItem.position}`,
      `CV becerileri: ${resumeProfile.skills.join(", ") || "yok"}`,
      "",
      "| | Gereksinim | Önem | Karar | Yöntem | Kanıt |",
      "|---|---|---|---|---|---|",
    )
    for (const [i, r] of outcome.requirements.entries()) {
      const ev = r.evidence ? `${r.evidence.kind}: ${truncate(r.evidence.text, 60)}` : "—"
      rows.push(
        `| ${i + 1} | ${truncate(r.requirement.text, 70)} | ${r.requirement.importance} ` +
          `| ${r.status === "matched" ? "✓" : "✗"} | ${r.method ?? "—"} | ${ev} |`,
      )
    }
    rows.push("", `Eksik kelimeler: ${outcome.missingKeywords.join(", ") || "yok"}`, "")
    console.log(`${pairItem.resumeId} × ${pairItem.postingId}: skor ${outcome.score} (${postingDataItem.requirements.length} gereksinim)`)
  }

  // Yeni çıkarım yapıldıysa süre ve token kaydı; modelleri karşılaştırırken
  // hız ve maliyet buradan okunuyor.
  if (Object.keys(timings).length > 0) {
    writeFileSync(join(CACHE, "timings.json"), JSON.stringify(timings, null, 2))
  }

  writeFileSync(RAPOR, rows.join("\n"))
  console.log(`\nİnceleme raporu: ${RAPOR}`)
}

/** Sağlayıcının harcadığı token'ları sayar. */
class CountingLlm implements LlmProvider {
  tokens = 0
  constructor(private readonly inner: LlmProvider) {}
  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    const outcome = await this.inner.extract<T>(opts)
    this.tokens += outcome.tokens
    return outcome
  }
}

/** Çıkarım başına süre (sn) ve token; yalnızca bu koşuda yapılanlar. */
const timings: Record<string, { seconds: number; tokens: number }> = {}

/** Sonucu diske yazar; varsa LLM'i hiç çağırmaz. */
async function cachedOrRun<T>(
  name: string,
  refresh: boolean,
  produce: () => Promise<T>,
  llm?: CountingLlm,
): Promise<T> {
  const filePath = join(CACHE, `${name}.json`)
  if (!refresh && existsSync(filePath)) {
    console.log(`  [önbellek] ${name}`)
    return JSON.parse(readFileSync(filePath, "utf8")) as T
  }
  const startedAt = Date.now()
  const tokensBefore = llm?.tokens ?? 0
  const outcome = await produce()
  writeFileSync(filePath, JSON.stringify(outcome, null, 2))
  const seconds = Math.round((Date.now() - startedAt) / 100) / 10
  timings[name] = { seconds, tokens: (llm?.tokens ?? 0) - tokensBefore }
  console.log(`  [çıkarım] ${name} (${seconds}s)`)
  return outcome
}

function truncate(rawText: string, n: number): string {
  const single = rawText.replace(/\s+/g, " ").trim()
  return single.length <= n ? single : `${single.slice(0, n - 1)}…`
}

void main()
