import { readFileSync } from "node:fs"
import { join } from "node:path"
import { planOnePage } from "../src/adapt/onePage.js"
import { bulletId, projectBulletId } from "../src/adapt/profile.js"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import type { AdaptationDraft } from "../src/schemas/adaptation.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { cacheDir } from "./types.js"

/**
 * Tek sayfa stratejisi (DOG-93): değerlendirme çiftlerinde plan ne yapıyor.
 *
 * Taslak yeniden yazımsız (yalnızca özgün maddeler): ölçülen şey planın
 * kendisi. Raporlanan: sıkı yerleşimde sayfa, çıkarılan madde sayısı ve
 * skor öncesi/sonrası. Plan skoru düşürmemeli.
 *
 * Kullanım: pnpm eval:onepage
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)

function untouchedDraft(profile: ResumeProfile): AdaptationDraft {
  const bullets = [
    ...profile.experience.flatMap((job, i) => job.bullets.map((b, j) => ({ id: bulletId(i, j), text: b.text, sourceRef: b.sourceRef }))),
    ...(profile.projects ?? []).flatMap((p, i) => p.bullets.map((b, j) => ({ id: projectBulletId(i, j), text: b.text, sourceRef: b.sourceRef }))),
  ]
  return {
    summary: { original: profile.summary, rewritten: profile.summary ?? "", verification: { status: "ok", issues: [] }, decision: "rejected" },
    bullets: bullets.map((b) => ({ id: b.id, original: b.text, sourceRef: b.sourceRef, rewritten: b.text, verification: { status: "ok", issues: [] }, decision: "rejected" })),
    skillOrder: profile.skills,
  }
}

async function main() {
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const pairs = JSON.parse(readFileSync(join(KOK, "sources", "pairs.json"), "utf8")).pairs as Array<{ resumeId: string; postingId: string }>
  for (const pair of pairs) {
    const profile = JSON.parse(readFileSync(join(CACHE, `cv-${pair.resumeId}.json`), "utf8")) as ResumeProfile
    const posting = JSON.parse(readFileSync(join(CACHE, `ilan-${pair.postingId}.json`), "utf8")) as JobPostingData
    const draft = untouchedDraft(profile)
    const plan = await planOnePage({ profile, posting, draft }, embedding)
    if (plan.pagesBefore <= 1 && plan.omitted.length === 0) {
      console.log(`  ${pair.resumeId.slice(0, 4)}×${pair.postingId.padEnd(8)} sıkı yerleşimle tek sayfa`)
      continue
    }
    console.log(
      `  ${pair.resumeId.slice(0, 4)}×${pair.postingId.padEnd(8)} ${plan.pagesBefore} → ${plan.pages} sayfa · ` +
        `${plan.omitted.length}/${draft.bullets.length} madde çıktı · skor ${plan.scoreBefore} → ${plan.scoreAfter}` +
        (plan.fits ? "" : " · SIĞMADI"),
    )
    for (const id of plan.omitted) console.log(`      − ${draft.bullets.find((b) => b.id === id)!.original.slice(0, 90)}`)
  }
}

void main()
