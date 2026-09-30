import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../llm/embedding.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { extractResumeProfile } from "../extract/resume.js"
import { extractJobPosting } from "../extract/job.js"
import { collectEvidence } from "./evidence.js"
import { conceptTexts, score } from "./score.js"

const CV = `Elif Yılmaz
Frontend Geliştirici · İstanbul

HAKKIMDA
3 yıldır React ve TypeScript ile kurumsal arayüzler geliştiriyorum.

DENEYİM
Acme Teknoloji · Frontend Geliştirici · Ocak 2022 – halen
- React ve TypeScript ile müşteri self servis panelini sıfırdan geliştirdim
- Sayfa yüklenme süresini %40 düşürdüm, Lighthouse skorunu 62'den 94'e çıkardım
- 4 kişilik ekipte kod inceleme sürecini kurdum

EĞİTİM
Bir Teknik Üniversite, Bilgisayar Mühendisliği, 2021

BECERİLER
React, TypeScript, Next.js, Git, Jest`

const POSTING = `Frontend Geliştirici (Acme Teknoloji)

Aradığımız nitelikler:
- En az 3 yıl React deneyimi
- TypeScript bilgisi şarttır
- Git ile versiyon kontrolü deneyimi
- Kubernetes ile konteyner yönetimi zorunludur
- Bilgisayar mühendisliği veya ilgili bölüm mezunu

Tercihen:
- Next.js deneyimi
- Takım çalışmasına yatkın olmak`

describe("end-to-end score · real models", () => {
  it("produces an explainable score from a resume and a posting", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

    const startedAt = Date.now()

    const resumeProfile = await extractResumeProfile(llm, CV)
    const testPosting = await extractJobPosting(llm, POSTING)

    const evidenceList = collectEvidence(resumeProfile.data)
    const evidenceTexts = evidenceList.map((k) => k.text)
    const conceptTextList = conceptTexts(testPosting.data)
    const vecs = await embedding.embed([...evidenceTexts, ...conceptTextList])

    const outcome = score({
      profile: resumeProfile.data,
      posting: testPosting.data,
      evidence: evidenceList,
      evidenceVectors: vecs.slice(0, evidenceTexts.length),
      conceptVectors: vecs.slice(evidenceTexts.length),
    })

    const duration = Date.now() - startedAt

    console.log(`\n  ═══ SKOR: ${outcome.score} ═══  (${duration} ms, ${resumeProfile.tokens + testPosting.tokens} token)`)
    console.log(`  kanıt sayısı: ${evidenceList.length}, gereksinim sayısı: ${testPosting.data.requirements.length}\n`)
    for (const r of outcome.requirements) {
      const mark = r.status === "matched" ? "✓" : "✗"
      const approach = r.method ? `${r.method} ${r.confidence.toFixed(2)}` : "—"
      console.log(`  ${mark} [${r.requirement.importance}] ${r.requirement.text}  (${approach})`)
      if (r.evidence) console.log(`      kanıt: ${r.evidence.text}`)
    }
    console.log(`\n  eksik kelimeler: ${outcome.missingKeywords.join(", ") || "yok"}`)

    // Kubernetes CV'de gerçekten yok: uydurma eşleşme olmamalı.
    const kubernetes = outcome.requirements.find((r) => /kubernetes/i.test(r.requirement.text))
    expect(kubernetes?.status).toBe("missing")

    // React CV'de açıkça var: kaçırılmamalı.
    const react = outcome.requirements.find((r) => /react/i.test(r.requirement.text))
    expect(react?.status).toBe("matched")

    expect(outcome.score).toBeGreaterThan(0)
    expect(outcome.score).toBeLessThan(100)
  })
})
