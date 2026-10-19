import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { buildContribution } from "../src/adapt/contribution.js"
import { markFactEvidence, withFacts, type RememberedFact } from "../src/adapt/facts.js"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import { resumeLanguage } from "../src/normalize/language.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { scoreProfile } from "../src/score/live.js"
import { compareToExpectations } from "./compare.js"
import { cacheDir, type EvalPair } from "./types.js"

/**
 * Olgu hafızası (DOG-116): bir uyarlamada anlatılan deneyim sonraki
 * analizlerde kanıt sayılınca ne oluyor.
 *
 * Her vaka: bir çiftte eksik kalan gereksinim için kullanıcının cevabı. Cevap
 * "AI ile yaz" hattından (buildContribution) maddeye çevriliyor, olgu olarak
 * profile ekleniyor ve aynı CV'nin bütün çiftleri yeniden puanlanıyor.
 * Ölçülenler:
 *   - Hedef: anlatılan gereksinim artık karşılanıyor mu, skor ne kadar değişti.
 *   - Yayılma: başka ilanlarda olgu yüzünden karşılanan gereksinimler; elle
 *     gözden geçirilmek üzere listeleniyor.
 *   - Uydurma: hedef dışındaki beklentilerde uydurma arttı mı.
 *
 * Kullanım: pnpm eval:facts
 */
const KOK = import.meta.dirname
const CACHE = cacheDir(KOK)

interface Case {
  name: string
  resumeId: string
  postingId: string
  /** Hedef gereksinimin metninde geçen parça. */
  requirement: string
  experienceIndex: number
  answer: string
}

const CASES: Case[] = [
  {
    name: "ai-faiss",
    resumeId: "cv-a-ai-engineer",
    postingId: "ilan-2",
    requirement: "FAISS",
    experienceIndex: 0,
    answer: "telekomdaki RAG projesinde doküman parçalarının vektörlerini FAISS indeksinde tuttum, yaklaşık 200 bin parça vardı",
  },
  {
    name: "ai-observability",
    resumeId: "cv-a-ai-engineer",
    postingId: "ilan-3",
    requirement: "Observability for LLM",
    experienceIndex: 0,
    answer: "LLM çağrılarını Langfuse ile izledim, gecikmeyi ve token maliyetini panelden haftalık takip ettim",
  },
  {
    name: "pazarlama-ai",
    resumeId: "cv-d-pazarlama",
    postingId: "ilan-6",
    requirement: "AI araçlarını",
    experienceIndex: 0,
    answer: "reklam metinlerinin ilk taslaklarını ChatGPT ile yazıp ekiple birlikte düzenliyordum",
  },
  {
    name: "muhasebe-is-hukuku",
    resumeId: "cv-e-muhasebe",
    postingId: "ilan-11",
    requirement: "İş hukuku",
    experienceIndex: 0,
    answer: "işten çıkışlarda kıdem ve ihbar tazminatı hesaplarını hazırlayıp İK ile birlikte kontrol ettim",
  },
  {
    // Kısmi: Docker anlatılıyor, Kubernetes anlatılmıyor; Kubernetes eksik kalmalı.
    name: "stajyer-docker",
    resumeId: "cv-c-yeni-mezun",
    postingId: "ilan-2",
    requirement: "Docker, Kubernetes",
    experienceIndex: 2,
    answer: "staj projesinde uygulamayı docker compose ile 3 servis olarak ayağa kaldırdım",
  },
]

const json = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T

function pairsOf(resumeId: string): EvalPair[] {
  return readdirSync(join(KOK, "pairs"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => json<EvalPair>(join(KOK, "pairs", f)))
    .filter((p) => p.resumeId === resumeId)
}

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  let targetHits = 0
  let spread = 0
  let fabricationDelta = 0

  for (const c of CASES) {
    const profile = json<ResumeProfile>(join(CACHE, `cv-${c.resumeId}.json`))
    const posting = json<JobPostingData>(join(CACHE, `ilan-${c.postingId}.json`))
    const index = posting.requirements.findIndex((r) => r.text.includes(c.requirement))
    const requirement = posting.requirements[index]!
    const built = await buildContribution(llm, embedding, {
      requirement,
      answer: c.answer,
      posting,
      language: resumeLanguage(profile),
    })
    const job = profile.experience[c.experienceIndex]!
    const fact: RememberedFact = {
      id: c.name,
      company: job.company,
      title: job.title,
      text: built.text,
      answer: c.answer,
      requirement: requirement.text,
      createdAt: new Date().toISOString(),
    }
    const merged = withFacts(profile, built.text ? [fact] : [])
    console.log(`${c.name}  (${built.verification.status}, ${built.decision})\n   madde: ${built.text || "—boş—"}`)

    for (const pair of pairsOf(c.resumeId)) {
      const pairPosting = json<JobPostingData>(join(CACHE, `ilan-${pair.postingId}.json`))
      const before = await scoreProfile({ profile, posting: pairPosting }, embedding)
      const after = markFactEvidence(await scoreProfile({ profile: merged.profile, posting: pairPosting }, embedding), merged.applied)
      const flipped = after.requirements.flatMap((r, i) =>
        r.evidence?.fact && before.requirements[i]!.status !== "matched" ? [r.requirement.text] : [],
      )
      const isTarget = pair.postingId === c.postingId
      // Hedef beklenti "karşılanmamalı" diye yazılmış: o kalem uydurma sayımından çıkıyor.
      const expectations = isTarget ? pair.expectations.filter((e) => !requirement.text.includes(e.match)) : pair.expectations
      const fabBefore = compareToExpectations(pair.id, before, expectations, 0).fabrications
      const fabAfter = compareToExpectations(pair.id, after, expectations, 0).fabrications
      fabricationDelta += fabAfter - fabBefore
      if (isTarget && after.requirements[index]!.status === "matched") targetHits++
      if (!isTarget) spread += flipped.length
      const target = isTarget
        ? ` · hedef ${before.requirements[index]!.status} ${before.requirements[index]!.confidence.toFixed(2)} → ${after.requirements[index]!.status} ${after.requirements[index]!.confidence.toFixed(2)} (eksik: ${after.requirements[index]!.missingConcepts.join(", ") || "—"})`
        : ""
      console.log(
        `   ${pair.id.padEnd(16)} skor ${before.score} → ${after.score}${target} · uydurma ${fabBefore} → ${fabAfter}` +
          (flipped.length && !isTarget ? `\n      olguyla karşılanan: ${flipped.join(" | ")}` : ""),
      )
    }
    console.log()
  }
  console.log(`Hedef karşılandı: ${targetHits}/${CASES.length} · başka ilanlara yayılma: ${spread} · uydurma farkı: ${fabricationDelta}`)
}

void main()
