import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { LmStudioProvider, llmConfigFromEnv, extractResumeProfile, extractJobPosting,
         OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv,
         collectEvidence, score } from "@uyarla/core"

const CV_DIR = "/tmp/uyarla-eval"
const ILAN_DIR = "/Users/doganaybalaban/Desktop/uyarla/docs/ilan"
const OUT = "/tmp/uyarla-eval/faz-a"
mkdirSync(OUT, { recursive: true })

const CIFTLER = [
  ["cv-a-ai-engineer", "1"], ["cv-a-ai-engineer", "2"], ["cv-a-ai-engineer", "3"],
  ["cv-a-ai-engineer", "5"],
  ["cv-b-test-engineer", "1"], ["cv-b-test-engineer", "3"], ["cv-b-test-engineer", "4"],
  ["cv-c-yeni-mezun", "1"], ["cv-c-yeni-mezun", "2"], ["cv-c-yeni-mezun", "4"],
]

const llm = new LmStudioProvider(llmConfigFromEnv())
const emb = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

// Ayni CV birden cok ilanla eslesiyor: profil cikarimini onbellekle.
const profilCache = new Map()
const ilanCache = new Map()

for (const [cvId, ilanId] of CIFTLER) {
  const id = `${cvId}__ilan-${ilanId}`
  const t0 = Date.now()
  try {
    if (!profilCache.has(cvId)) {
      const t = Date.now()
      profilCache.set(cvId, await extractResumeProfile(llm, readFileSync(`${CV_DIR}/${cvId}.anon.txt`, "utf8")))
      console.log(`  [cv] ${cvId} çıkarıldı (${Math.round((Date.now()-t)/1000)}s)`)
    }
    if (!ilanCache.has(ilanId)) {
      const t = Date.now()
      ilanCache.set(ilanId, await extractJobPosting(llm, readFileSync(`${ILAN_DIR}/${ilanId}.txt`, "utf8")))
      console.log(`  [ilan] ${ilanId} çıkarıldı (${Math.round((Date.now()-t)/1000)}s)`)
    }
    const profil = profilCache.get(cvId)
    const ilan = ilanCache.get(ilanId)

    const kanitlar = collectEvidence(profil.data)
    const kt = kanitlar.map(k => k.text)
    const gt = ilan.data.requirements.map(r => r.text)
    const vek = await emb.embed([...kt, ...gt])
    const sonuc = score({
      profile: profil.data, posting: ilan.data, evidence: kanitlar,
      evidenceVectors: vek.slice(0, kt.length), requirementVectors: vek.slice(kt.length),
    })

    writeFileSync(`${OUT}/${id}.json`, JSON.stringify({
      id, cvId, ilanId,
      pozisyon: ilan.data.position, sirket: ilan.data.company, dil: ilan.data.language,
      skor: sonuc.score,
      kanitSayisi: kanitlar.length,
      beceriler: profil.data.skills,
      deneyimler: profil.data.experience.map(e => `${e.title} · ${e.company}`),
      gereksinimler: sonuc.requirements.map(r => ({
        text: r.requirement.text, tur: r.requirement.type, onem: r.requirement.importance,
        kw: r.requirement.keywords, durum: r.status, yontem: r.method,
        guven: Math.round(r.confidence * 100) / 100,
        kanit: r.evidence ? `[${r.evidence.kind}] ${r.evidence.text}` : null,
      })),
    }, null, 2))
    console.log(`${id}: skor ${sonuc.score} · ${sonuc.requirements.length} gereksinim · ${Math.round((Date.now()-t0)/1000)}s`)
  } catch (e) {
    console.log(`${id}: HATA — ${e.message}`)
  }
}
console.log("FAZ A TAMAM")
