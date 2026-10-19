import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { checkCoverLetter } from "../src/cover/checks.js"
import { COVER_LETTER_PROMPT, MISSING_REQUIREMENT_RULE, generateCoverLetter } from "../src/cover/letter.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv, type ExtractOptions, type ExtractResult, type LlmProvider } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { cacheDir, type EvalPair } from "./types.js"

/**
 * Ön yazıda eksik gereksinim kuralı (DOG-122): "hiç bahsetme" mi, "dürüst
 * köprü" mü?
 *
 * Uydurma kontrolü CV'de olmayan her ilan terimini işaretliyor; dürüst bir
 * "X ile doğrudan çalışmadım" cümlesi de işaretleniyor. Bu yüzden işaretli
 * her cümle sınıflanıyor:
 *   - sahiplenme: terim olumsuzlanmadan geçiyor ("X deneyimim var"); uydurma.
 *   - dürüst: terimin yakınında olumsuzluk var ("X ile çalışmadım").
 *   - unvan: terim yalnızca ilandaki unvanın içinde geçiyor ("Muhasebe
 *     Uzmanı pozisyonu"); yanlış alarm.
 * Sınıflama kalıpla; çıktı runs/onyazi-kural-<zaman>.json, cümleler elle de
 * okunmalı.
 *
 * Kullanım: pnpm eval:cover-rules
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

const SILENT_RULE = `- İlanın istediği bir şey CV'de yoksa ondan hiç bahsetme; yalan söyleme,
  özür de dileme.`

const BRIDGE_RULE = `- İlanın istediği bir şey CV'de yoksa onu SAHİPLENME: "deneyimim var",
  "bilgim var", "kullanabiliyorum" gibi yazma. İstersen en fazla bir cümleyle
  dürüst bir köprü kur: o konuda doğrudan deneyimin olmadığını açıkça söyle ve
  CV'deki en yakın deneyimi yaz (ör. "X ile doğrudan çalışmadım; Y'de …
  yaptım"). Özür dileme, kendini küçümseme.`

if (!COVER_LETTER_PROMPT.includes(MISSING_REQUIREMENT_RULE)) throw new Error("İstemdeki kural değişmiş; eval güncellenmeli.")

/**
 * Üç hâl. "köprü+" bugünkü istem (K-76); "sessiz" eski kural, "köprü" ilk
 * denenen gevşek köprü. Karşılaştırma tekrarlanabilir kalsın diye ikisi de
 * duruyor.
 */
const VARIANTS = [
  { name: "sessiz", prompt: COVER_LETTER_PROMPT.replace(MISSING_REQUIREMENT_RULE, SILENT_RULE) },
  { name: "köprü", prompt: COVER_LETTER_PROMPT.replace(MISSING_REQUIREMENT_RULE, BRIDGE_RULE) },
  { name: "köprü+", prompt: COVER_LETTER_PROMPT },
]

/** eval:cover'daki gibi: yanıtlar istek özetiyle saklanıyor; hâller o önbelleği paylaşıyor. */
class CachingLlm implements LlmProvider {
  private readonly record: Record<string, ExtractResult<unknown>>
  constructor(
    private readonly inner: LlmProvider,
    private readonly filePath: string,
  ) {
    this.record = existsSync(filePath) ? (JSON.parse(readFileSync(filePath, "utf8")) as Record<string, ExtractResult<unknown>>) : {}
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
    writeFileSync(this.filePath, JSON.stringify(this.record, null, 2))
  }
}

const NEGATION =
  /(değil|yok|olmadı|olmasa|olmamakla|çalışmadım|kullanmadım|deneyimim olmadı|doğrudan|henüz|haven't|have not|hasn't|not yet|no direct|without direct|did not|didn't)/i

type Kind = "sahiplenme" | "dürüst" | "unvan"

function classify(sentence: string, term: string, posting: JobPostingData): Kind {
  const lower = sentence.toLocaleLowerCase("tr")
  const position = posting.position.toLocaleLowerCase("tr")
  if (position.includes(term.toLocaleLowerCase("tr")) && lower.includes(position.split(/\s\/\s/)[0]!.slice(0, 12))) return "unvan"
  return NEGATION.test(sentence) ? "dürüst" : "sahiplenme"
}

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const files = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort()
  const totals = new Map(VARIANTS.map((v) => [v.name, { flaggedParagraphs: 0, paragraphs: 0, sahiplenme: 0, dürüst: 0, unvan: 0, words: 0, cliches: 0, negated: 0 }]))
  const rows: unknown[] = []

  for (const file of files) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${pair.resumeId}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${pair.postingId}.json`), "utf8")) as JobPostingData
    const cache = new CachingLlm(llm, join(CACHE, `onyazi-${pair.id}.json`))
    const line: string[] = []
    for (const v of VARIANTS) {
      const { data } = await generateCoverLetter(cache, { profile, posting }, { prompt: v.prompt })
      const t = totals.get(v.name)!
      t.paragraphs += data.paragraphs.length
      t.words += data.paragraphs.reduce((n, p) => n + p.text.split(/\s+/).length, 0)
      const found: Array<{ term: string; kind: Kind; sentence: string }> = []
      for (const p of data.paragraphs) {
        if (p.verification.status === "flagged") t.flaggedParagraphs++
        for (const issue of p.verification.issues) {
          const term = issue.detail.match(/"([^"]+)"/)?.[1] ?? ""
          const sentence =
            p.text.split(/(?<=[.!?])\s+/).find((s) => s.toLocaleLowerCase("tr").includes(term.toLocaleLowerCase("tr"))) ?? p.text
          const kind = classify(sentence, term, posting)
          t[kind]++
          found.push({ term, kind, sentence })
        }
      }
      const checks = checkCoverLetter(data.paragraphs.map((p) => p.text), posting)
      t.cliches += checks.cliches.length
      // Doğrulamanın artık işaretlemediği dürüst köprüler: olumsuzluk içeren cümle sayısı.
      t.negated += data.paragraphs.flatMap((p) => p.text.split(/(?<=[.!?])\s+/)).filter((x) => NEGATION.test(x)).length
      rows.push({ pair: pair.id, variant: v.name, paragraphs: data.paragraphs.map((p) => p.text), found, cliches: checks.cliches })
      line.push(`${v.name}: ${found.filter((f) => f.kind === "sahiplenme").length} sahiplenme`)
    }
    cache.save()
    console.log(`${pair.id.padEnd(16)} ${line.join(" · ")}`)
  }

  console.log("\nToplam (işaretli paragraf / paragraf · sahiplenme · işaretli dürüst · unvan · olumsuz cümle · klişe · ort. kelime)")
  for (const [name, t] of totals) {
    console.log(
      `  ${name.padEnd(8)} ${t.flaggedParagraphs}/${t.paragraphs} · ${t.sahiplenme} · ${t.dürüst} · ${t.unvan} · ${t.negated} · ${t.cliches} · ${Math.round(t.words / files.length)}`,
    )
  }
  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const out = join(RUNS, `onyazi-kural-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  writeFileSync(out, JSON.stringify({ totals: Object.fromEntries(totals), rows }, null, 2))
  console.log(`\nMetinler: ${out}`)
}

void main()
