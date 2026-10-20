import { readFileSync } from "node:fs"
import { join } from "node:path"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import { headlineTitles, linkedinStrengths, suggestLinkedInText } from "../src/linkedin/suggest.js"
import type { ScoredPosting } from "../src/linkedin/report.js"
import { ABOUT_TARGET_WORDS, HEADLINE_MAX_CHARS } from "../src/linkedin/reportRecord.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { scoreProfile } from "../src/score/live.js"
import { findCliches } from "../src/text/cliches.js"
import { cacheDir } from "./types.js"

/**
 * LinkedIn başlık ve "Hakkında" önerisi (DOG-69).
 *
 * Beş CV, her biri kendi alanından 1–3 ilanla. Ölçülenler: uydurma işareti,
 * başlık uzunluğu, başlıktaki unvanın izin verilen unvanlardan biri olması,
 * "Hakkında" kelime aralığı, klişe. Metinler elle de okunmalı.
 *
 * Kullanım: pnpm eval:linkedin
 */
const CACHE = cacheDir(import.meta.dirname)
const SETS: Array<[string, string[], string | null]> = [
  ["cv-a-ai-engineer", ["ilan-1", "ilan-2", "ilan-3"], null],
  ["cv-b-test-engineer", ["ilan-10"], "Test Mühendisi"],
  ["cv-d-pazarlama", ["ilan-6"], null],
  ["cv-e-muhasebe", ["ilan-11"], "Muhasebe Uzmanı"],
  ["cv-f-satis", ["ilan-8"], null],
]

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const t = { total: 0, flagged: 0, longHeadline: 0, badTitle: 0, aboutOff: 0, cliches: 0 }
  for (const [cv, ilanlar, target] of SETS) {
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${cv}.json`), "utf8")) as ResumeProfile
    const postings = ilanlar.map((i) => JSON.parse(readFileSync(join(CACHE, `ilan-${i}.json`), "utf8")) as JobPostingData)
    const scored: ScoredPosting[] = []
    for (const [i, posting] of postings.entries()) {
      scored.push({ analysisId: ilanlar[i]!, position: posting.position, company: posting.company, result: await scoreProfile({ profile, posting }, embedding) })
    }
    const { data } = await suggestLinkedInText(llm, { profile, scored, postings, targetRole: target })
    const titles = headlineTitles(profile, target)
    t.total++
    const issues: string[] = []
    for (const [name, s] of [["başlık", data.headline], ["hakkında", data.about]] as const) {
      if (s.verification.status === "flagged") {
        t.flagged++
        issues.push(`${name} ⚠ ${s.verification.issues.map((i) => i.detail).join(" | ")}`)
      }
    }
    if (data.headline.text.length > HEADLINE_MAX_CHARS) (t.longHeadline++, issues.push("uzun başlık"))
    const head = data.headline.text.split("|")[0]!.trim().toLocaleLowerCase("tr")
    if (!titles.some((x) => head.includes(x.toLocaleLowerCase("tr")) || x.toLocaleLowerCase("tr").includes(head))) (t.badTitle++, issues.push(`unvan dışı: "${head}"`))
    const words = data.about.text.split(/\s+/).filter(Boolean).length
    if (words < ABOUT_TARGET_WORDS.min - 10 || words > ABOUT_TARGET_WORDS.max + 20) (t.aboutOff++, issues.push(`hakkında ${words} kelime`))
    const hits = [...findCliches(data.headline.text), ...findCliches(data.about.text)]
    t.cliches += hits.length
    if (hits.length) issues.push(`klişe: ${hits.map((h) => h.phrase).join(", ")}`)
    console.log(`${cv.padEnd(22)} ${issues.length ? issues.join(" · ") : "✓"}`)
    console.log(`   unvanlar: ${titles.join(" · ")} | beceriler: ${linkedinStrengths(scored, profile).join(", ")}`)
    console.log(`   başlık  : ${data.headline.text}`)
    console.log(`   hakkında: ${data.about.text}\n`)
  }
  console.log(`Profil ${t.total} · işaretli ${t.flagged} · uzun başlık ${t.longHeadline} · unvan dışı ${t.badTitle} · hakkında aralık dışı ${t.aboutOff} · klişe ${t.cliches}`)
}

void main()
