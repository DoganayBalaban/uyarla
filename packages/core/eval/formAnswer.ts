import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { generateFormAnswer, measure, type FormAnswerLimit } from "../src/cover/formAnswer.js"
import { generateCoverLetter } from "../src/cover/letter.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv, type ExtractOptions, type ExtractResult, type LlmProvider } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { findCliches } from "../src/text/cliches.js"
import { cacheDir, type EvalPair } from "./types.js"

/**
 * Başvuru formu yanıtları (DOG-123).
 *
 * Her çift için gönderilen belgeler: CV ve ön yazı (eval:cover önbelleğinden).
 * Dört soru: sınırsız tanıtım, 140 karakter "neden sen", 80 kelime "neden bu
 * şirket", 500 karakter en ilgili deneyim. Ölçülenler:
 *   - Uydurma kontrolünün işaretlediği yanıt.
 *   - Sınırı aşan (kısaltma ve kesmeye rağmen) yanıt.
 *   - Klişe.
 *   - "Neden bu şirket"te yer tutucu ya da ilandan bir dayanak.
 * Metinler elle de okunmalı.
 *
 * Kullanım: pnpm eval:form-answer
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)
const PAIRS = join(KOK, "pairs")

/** Ön yazı önbelleğini okuyan sağlayıcı; olmayan yanıtı modele soruyor ama kaydetmiyor. */
class ReadThroughLlm implements LlmProvider {
  private readonly record: Record<string, ExtractResult<unknown>>
  constructor(
    private readonly inner: LlmProvider,
    file: string,
  ) {
    this.record = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, ExtractResult<unknown>>) : {}
  }
  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    const key = createHash("sha256").update(`${opts.schemaName}\n${opts.prompt}\n${opts.input}`).digest("hex")
    return (this.record[key] as ExtractResult<T> | undefined) ?? this.inner.extract<T>(opts)
  }
}

const QUESTIONS: Array<{ id: string; question: string; limit: FormAnswerLimit | null }> = [
  { id: "tanit", question: "Kendinizi kısaca tanıtır mısınız?", limit: null },
  { id: "neden-sen", question: "140 karakterde: neden sizi seçmeliyiz?", limit: { unit: "chars", max: 140 } },
  { id: "neden-sirket", question: "Neden şirketimizde çalışmak istiyorsunuz?", limit: { unit: "words", max: 80 } },
  { id: "deneyim", question: "Bu pozisyonla en ilgili deneyiminizi anlatın.", limit: { unit: "chars", max: 500 } },
]

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const files = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort().slice(0, 5)
  const t = { total: 0, flagged: 0, overLimit: 0, cliches: 0, companyNoBasis: 0 }

  for (const file of files) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${pair.resumeId}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${pair.postingId}.json`), "utf8")) as JobPostingData
    const letter = await generateCoverLetter(new ReadThroughLlm(llm, join(CACHE, `onyazi-${pair.id}.json`)), { profile, posting })
    const coverLetter = letter.data.paragraphs.map((p) => p.text)

    for (const q of QUESTIONS) {
      const { data } = await generateFormAnswer(llm, { profile, coverLetter, posting, question: q.question, limit: q.limit })
      t.total++
      const issues: string[] = []
      if (data.verification.status === "flagged") {
        t.flagged++
        issues.push(`⚠ ${data.verification.issues.map((i) => i.detail).join(" | ")}`)
      }
      if (data.overLimit || (q.limit && measure(data.text, q.limit.unit) > q.limit.max)) {
        t.overLimit++
        issues.push("sınır aşıldı")
      }
      const hits = findCliches(data.text)
      t.cliches += hits.length
      if (hits.length) issues.push(`klişe: ${hits.map((h) => h.phrase).join(", ")}`)
      // Uydurulmuş kişisel gerekçe kalıpları; yer tutucu yoksa sayılıyor.
      const motive = /takip ediyorum|heyecan|hayranlık|tutku|vizyonunuz|her zaman istedim|hayalim/i.test(data.text)
      if (q.id === "neden-sirket" && !data.text.includes("[kendi gerekçen]") && motive) {
        t.companyNoBasis++
        issues.push("uydurma kişisel gerekçe")
      }
      const size = q.limit ? `${measure(data.text, q.limit.unit)}/${q.limit.max} ${q.limit.unit}` : `${data.text.split(/\s+/).length} kelime`
      console.log(`${pair.id.padEnd(16)} ${q.id.padEnd(13)} ${size.padEnd(16)} ${issues.length ? issues.join(" · ") : "✓"}`)
      console.log(`   ${data.text.replace(/\n+/g, " ⏎ ")}\n`)
    }
  }
  console.log(`Yanıt ${t.total} · işaretli ${t.flagged} · sınır aşan ${t.overLimit} · klişe ${t.cliches} · uydurma kişisel gerekçe ${t.companyNoBasis}`)
}

void main()
