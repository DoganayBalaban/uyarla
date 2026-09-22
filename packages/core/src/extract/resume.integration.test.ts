import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { extractResumeProfile } from "./resume.js"

const CV = `Elif Yılmaz
Frontend Geliştirici · İstanbul

HAKKIMDA
3 yıldır React ve TypeScript ile kurumsal arayüzler geliştiriyorum.

DENEYİM
Acme Teknoloji · Frontend Geliştirici · Ocak 2022 – halen
- React ve TypeScript ile müşteri self servis panelini sıfırdan geliştirdim
- Sayfa yüklenme süresini %40 düşürdüm, Lighthouse skorunu 62'den 94'e çıkardım
- 4 kişilik ekipte kod inceleme sürecini kurdum

Beta Yazılım · Junior Frontend Geliştirici · Haziran 2021 – Aralık 2021
- Vue.js ile iç raporlama aracının arayüzünü geliştirdim
- Birim test kapsamını %20'den %65'e çıkardım

EĞİTİM
Bir Teknik Üniversite, Bilgisayar Mühendisliği, 2021

BECERİLER
React, TypeScript, Next.js, Vue.js, Git, Jest, Tailwind CSS`

describe("extractResumeProfile · gerçek model", () => {
  it("Türkçe CV'den deneyim, eğitim ve becerileri çıkarır", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const basladi = Date.now()
    const { data, tokens } = await extractResumeProfile(llm, CV)
    const sure = Date.now() - basladi

    // K-09: süre bilinen bir risk; ölçüp raporluyoruz, test bunun üzerine
    // kurulmuyor. Karar Görev 13'te eval verisiyle verilecek.
    console.log(`[ölçüm] CV çıkarımı ${sure} ms, ${tokens} token`)

    expect(data.experience.length).toBeGreaterThanOrEqual(2)
    expect(data.experience[0]!.company).toMatch(/Acme/i)
    expect(data.experience[0]!.bullets.length).toBeGreaterThanOrEqual(2)
    expect(data.education.length).toBeGreaterThanOrEqual(1)
    expect(data.skills.join(" ").toLowerCase()).toContain("react")
  })

  it("sourceRef alanını ham metinden birebir kopyalar", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractResumeProfile(llm, CV)

    // Sprint 2'deki uydurma kontrolünün tüm ağırlığı bu güvencede.
    const hamMetin = CV.replace(/\s+/g, " ")
    for (const is of data.experience) {
      for (const madde of is.bullets) {
        expect(hamMetin).toContain(madde.sourceRef.replace(/\s+/g, " ").trim())
      }
    }
  })
})
