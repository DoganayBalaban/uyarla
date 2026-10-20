import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { generateFollowUp, type FollowUpChannel, type FollowUpKind } from "../src/cover/followUp.js"
import { generateCoverLetter } from "../src/cover/letter.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv, type ExtractOptions, type ExtractResult, type LlmProvider } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { findCliches } from "../src/text/cliches.js"
import { cacheDir, type EvalPair } from "./types.js"

/**
 * Takip mesajı ve teşekkür notu taslağı (DOG-117).
 *
 * Her çift için gönderilen belgeler: CV ve ön yazı (eval:cover önbelleğinden,
 * yeni üretim yok). Ölçülenler:
 *   - Uydurma kontrolünün işaretlediği taslak.
 *   - Kelime sayısı istenen aralıkta mı (takip 40–100, teşekkür 50–100).
 *   - Dil karışıyor mu: İngilizce ilanda Türkçe hitap ya da tersi.
 *   - Klişe.
 *   - Teşekkür notunda yer tutucu var mı (görüşme konusu uydurulmasın).
 * Metinler elle de okunmalı.
 *
 * Kullanım: pnpm eval:follow-up
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

const RANGE: Record<FollowUpKind, [number, number]> = { followup: [40, 100], thanks: [50, 100] }

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const files = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort().slice(0, 8)
  let flagged = 0
  let offLength = 0
  let cliches = 0
  let missingPlaceholder = 0
  let total = 0

  for (const file of files) {
    const pair = JSON.parse(readFileSync(join(PAIRS, file), "utf8")) as EvalPair
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${pair.resumeId}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${pair.postingId}.json`), "utf8")) as JobPostingData
    const letter = await generateCoverLetter(new ReadThroughLlm(llm, join(CACHE, `onyazi-${pair.id}.json`)), { profile, posting })
    const coverLetter = letter.data.paragraphs.map((p) => p.text)

    for (const [kind, channel] of [["followup", "email"], ["thanks", "email"]] as Array<[FollowUpKind, FollowUpChannel]>) {
      const { data } = await generateFollowUp(llm, { profile, coverLetter, posting, kind, channel, date: "2026-10-10" })
      total++
      const words = data.text.split(/\s+/).filter(Boolean).length
      const [min, max] = RANGE[kind]
      const issues: string[] = []
      if (data.verification.status === "flagged") {
        flagged++
        issues.push(`⚠ ${data.verification.issues.map((i) => i.detail).join(" | ")}`)
      }
      if (words < min - 10 || words > max + 10) {
        offLength++
        issues.push(`${words} kelime`)
      }
      const hits = findCliches(data.text)
      cliches += hits.length
      if (hits.length) issues.push(`klişe: ${hits.map((h) => h.phrase).join(", ")}`)
      const turkishGreeting = /^merhaba/i.test(data.text.trim())
      if ((posting.language === "en") === turkishGreeting) issues.push("dil karışık")
      if (kind === "thanks" && !data.text.includes("[görüşmede konuşulan bir konu]")) {
        missingPlaceholder++
        issues.push("yer tutucu yok")
      }
      console.log(`${pair.id.padEnd(16)} ${kind.padEnd(8)} ${issues.length ? issues.join(" · ") : "✓"}`)
      console.log(`   konu : ${data.subject ?? "—"}\n   metin: ${data.text.replace(/\n+/g, " ⏎ ")}\n`)
    }
  }
  console.log(`Taslak ${total} · işaretli ${flagged} · uzunluk dışı ${offLength} · klişe ${cliches} · yer tutucusuz teşekkür ${missingPlaceholder}`)
}

void main()
