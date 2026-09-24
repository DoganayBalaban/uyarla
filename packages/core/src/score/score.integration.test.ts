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

const ILAN = `Frontend Geliştirici (Acme Teknoloji)

Aradığımız nitelikler:
- En az 3 yıl React deneyimi
- TypeScript bilgisi şarttır
- Git ile versiyon kontrolü deneyimi
- Kubernetes ile konteyner yönetimi zorunludur
- Bilgisayar mühendisliği veya ilgili bölüm mezunu

Tercihen:
- Next.js deneyimi
- Takım çalışmasına yatkın olmak`

describe("uçtan uca skor · gerçek modeller", () => {
  it("CV ve ilandan açıklanabilir bir skor üretir", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

    const basladi = Date.now()

    const profil = await extractResumeProfile(llm, CV)
    const ilan = await extractJobPosting(llm, ILAN)

    const kanitlar = collectEvidence(profil.data)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const kavramMetinleri = conceptTexts(ilan.data)
    const vektorler = await embedding.embed([...kanitMetinleri, ...kavramMetinleri])

    const sonuc = score({
      profile: profil.data,
      posting: ilan.data,
      evidence: kanitlar,
      evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
      conceptVectors: vektorler.slice(kanitMetinleri.length),
    })

    const sure = Date.now() - basladi

    console.log(`\n  ═══ SKOR: ${sonuc.score} ═══  (${sure} ms, ${profil.tokens + ilan.tokens} token)`)
    console.log(`  kanıt sayısı: ${kanitlar.length}, gereksinim sayısı: ${ilan.data.requirements.length}\n`)
    for (const r of sonuc.requirements) {
      const isaret = r.status === "matched" ? "✓" : "✗"
      const yontem = r.method ? `${r.method} ${r.confidence.toFixed(2)}` : "—"
      console.log(`  ${isaret} [${r.requirement.importance}] ${r.requirement.text}  (${yontem})`)
      if (r.evidence) console.log(`      kanıt: ${r.evidence.text}`)
    }
    console.log(`\n  eksik kelimeler: ${sonuc.missingKeywords.join(", ") || "yok"}`)

    // Kubernetes CV'de gerçekten yok: uydurma eşleşme olmamalı.
    const kubernetes = sonuc.requirements.find((r) => /kubernetes/i.test(r.requirement.text))
    expect(kubernetes?.status).toBe("missing")

    // React CV'de açıkça var: kaçırılmamalı.
    const react = sonuc.requirements.find((r) => /react/i.test(r.requirement.text))
    expect(react?.status).toBe("matched")

    expect(sonuc.score).toBeGreaterThan(0)
    expect(sonuc.score).toBeLessThan(100)
  })
})
