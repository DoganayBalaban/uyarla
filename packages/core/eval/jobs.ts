import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { rankJobs } from "../src/jobSuggest/rank.js"
import { suggestionQuery } from "../src/jobSuggest/query.js"
import {
  searchCareerjet,
  searchJooble,
  type JobQuery,
  type JobSearchResult,
} from "../src/jobSuggest/sources.js"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { cacheDir } from "./types.js"

/**
 * Önerilen ilanlar denemesi (DOG-67).
 *
 * Değerlendirme setindeki her CV profili için Jooble ve Careerjet'e Türkiye
 * sorgusu atıyor, dönen ilanları CV'ye benzerliğe göre sıralıyor ve
 * ölçüyor: kaç ilan, hangi kaynaklardan, özet ne kadar dolu. İlk 10 ilan
 * `runs/oneriler-<zaman>.json`'a `ilgili: null` alanıyla yazılıyor; isabet o
 * alan elle işaretlenerek ölçülüyor.
 *
 * Yanıtlar `cache/ilanlar-<kaynak>-<cv>.json`'a yazılıyor: Jooble'ın ücretsiz
 * anahtarı toplam 500 istekle sınırlı, ölçüm tekrarlanırken harcanmamalı.
 *
 * Gerekli ortam değişkenleri (biri yoksa o kaynak atlanıyor):
 *   JOOBLE_API_KEY, JOOBLE_API_URL (öntanımlı https://tr.jooble.org/api/; Türkiye anahtarı yalnızca bu adreste geçerli)
 *   CAREERJET_API_KEY, CAREERJET_LOCALE (öntanımlı tr_TR),
 *   CAREERJET_PAGE_URL (sonuçların gösterildiği sayfa, Referer olarak gider)
 *
 * Kullanım:
 *   pnpm eval:jobs              önbellekten, eksikleri sorgula
 *   pnpm eval:jobs --refresh    bütün sorguları yenile
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const RUNS = join(KOK, "runs")
const TOP = 10

/** Careerjet aramayı yapan kişinin IP'sini istiyor; denemede o kişi biziz. */
async function ownVisitor() {
  const ip = (await (await fetch("https://api.ipify.org")).text()).trim()
  return { ip, userAgent: "Mozilla/5.0 (Macintosh) uyarla-spike/DOG-67" }
}

async function cached(
  name: string,
  refresh: boolean,
  run: () => Promise<JobSearchResult>,
): Promise<JobSearchResult & { cached: boolean }> {
  const path = join(CACHE, `ilanlar-${name}.json`)
  if (!refresh && existsSync(path)) return { ...JSON.parse(readFileSync(path, "utf8")), cached: true }
  const result = await run()
  writeFileSync(path, JSON.stringify(result, null, 2))
  return { ...result, cached: false }
}

async function main() {
  const refresh = process.argv.includes("--refresh")
  const jooble = process.env.JOOBLE_API_KEY
    ? { apiKey: process.env.JOOBLE_API_KEY, baseUrl: process.env.JOOBLE_API_URL ?? "https://tr.jooble.org/api/" }
    : null
  const careerjet = process.env.CAREERJET_API_KEY
    ? {
        apiKey: process.env.CAREERJET_API_KEY,
        locale: process.env.CAREERJET_LOCALE ?? "tr_TR",
        pageUrl: process.env.CAREERJET_PAGE_URL ?? "https://uyarla.com.tr/dashboard",
      }
    : null
  if (!jooble && !careerjet) {
    console.error("[eval:jobs] JOOBLE_API_KEY ya da CAREERJET_API_KEY gerekli (.env.example'a bak).")
    process.exit(1)
  }

  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const visitor = careerjet ? await ownVisitor() : null
  const cvIds = readdirSync(CACHE)
    .filter((f) => /^cv-cv-.*\.json$/.test(f))
    .map((f) => f.slice(3, -5))
    .sort()

  console.log(
    `[eval:jobs] ${cvIds.length} profil · kaynak: ${[jooble && "Jooble", careerjet && "Careerjet"].filter(Boolean).join(", ")}\n`,
  )

  const report: unknown[] = []
  let newCalls = 0
  for (const cvId of cvIds) {
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${cvId}.json`), "utf8")) as ResumeProfile
    const query: JobQuery = suggestionQuery(profile, {})
    const results = []
    if (jooble) results.push({ name: "jooble", ...(await cached(`jooble-${cvId}`, refresh, () => searchJooble(jooble, query))) })
    if (careerjet && visitor) {
      results.push({
        name: "careerjet",
        ...(await cached(`careerjet-${cvId}`, refresh, () => searchCareerjet(careerjet, query, visitor))),
      })
    }
    newCalls += results.filter((r) => !r.cached).length

    const all = results.flatMap((r) => r.jobs)
    const ranked = await rankJobs(embedding, profile, all)
    const origins = Object.entries(
      all.reduce<Record<string, number>>((acc, j) => {
        const key = j.origin ?? "?"
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      }, {}),
    ).sort((a, b) => b[1] - a[1])
    const avgSnippet = all.length ? Math.round(all.reduce((n, j) => n + j.snippet.length, 0) / all.length) : 0

    console.log(`== ${cvId} · "${query.keywords}" · ${query.location}`)
    for (const r of results) console.log(`   ${r.name.padEnd(9)} toplam ${r.total} · bu sayfada ${r.jobs.length}`)
    console.log(`   ortalama özet ${avgSnippet} karakter · kaynaklar: ${origins.slice(0, 5).map(([o, n]) => `${o} ${n}`).join(", ") || "—"}`)
    for (const [i, r] of ranked.slice(0, TOP).entries()) {
      console.log(`   ${String(i + 1).padStart(2)}. ${r.similarity.toFixed(2)}  ${r.job.title} · ${r.job.company ?? "?"} (${r.job.origin ?? r.job.source})`)
    }
    console.log("")

    report.push({
      cv: cvId,
      query,
      sources: results.map((r) => ({ name: r.name, total: r.total, returned: r.jobs.length })),
      avgSnippet,
      origins,
      top: ranked.slice(0, TOP).map((r) => ({ ...r.job, similarity: r.similarity, ilgili: null })),
    })
  }

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const out = join(RUNS, `oneriler-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`Yeni istek: ${newCalls} (Jooble ücretsiz anahtar: toplam 500)`)
  console.log(`İşaretleme için: ${out} (her ilanda "ilgili": true/false)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
