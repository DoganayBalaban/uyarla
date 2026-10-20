import { readFileSync } from "node:fs"
import { join } from "node:path"
import { reviewAnswer } from "../src/interview/practice.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { checkNumbers } from "../src/verify/numbers.js"
import { cacheDir } from "./types.js"

/**
 * Yazılı mülakat pratiği (DOG-97). Üç tür cevap: iyi kurulmuş STAR,
 * belirsiz kısa cevap, CV'de olmayan sayı içeren cevap. Ölçülenler:
 *   - STAR okuması beklenene uyuyor mu.
 *   - "Kağıtta yok" CV'de olmayan sayıyı yakalıyor mu.
 *   - Öneriler yeni olgu getiriyor mu: önerilerde cevapta ve CV'de olmayan sayı.
 *
 * Kullanım: pnpm eval:practice
 */
const CACHE = cacheDir(import.meta.dirname)
const profile = JSON.parse(readFileSync(join(CACHE, "cv-cv-e-muhasebe.json"), "utf8")) as ResumeProfile
const posting = JSON.parse(readFileSync(join(CACHE, "ilan-ilan-7.json"), "utf8")) as JobPostingData

const CASES = [
  {
    name: "iyi-star",
    question: "Mutabakat sürecinde bir sorunu nasıl çözdüğünü anlatır mısın?",
    answer:
      "Atlas Lojistik'te ay sonunda banka ve cari hesap mutabakatlarında farklar çıkıyordu. Benim görevim bu farkları ay kapanışından önce kapatmaktı. Hareketleri tek tek eşleştiren bir kontrol listesi hazırladım, farkları kaynaklarına göre sınıflandırdım ve sorumlu birimlere ilettim. Sonuçta mutabakatları her ay zamanında tamamladık ve kapanış gecikmeleri bitti.",
    expect: { situation: true, task: true, action: true, result: true },
  },
  {
    name: "belirsiz",
    question: "Bir hatayı nasıl yakaladığını anlatır mısın?",
    answer: "Genelde dikkatli çalışırım, hataları fark ederim ve düzeltirim. Detaylara önem veririm.",
    expect: { situation: false, task: false, action: false, result: false },
  },
  {
    name: "kagitta-yok",
    question: "KDV beyannamesi hazırlığını anlatır mısın?",
    answer:
      "Kuzey Gıda'da aylık KDV beyannamesi için verileri hazırlıyordum. 120 firmanın faturalarını kontrol ettim ve süreci 3 güne indirdim. Logo Tiger'da kayıtları eşleştirdim, farkları raporladım.",
    expect: null,
    offPaper: ["120", "3"],
  },
]

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  let wrongStar = 0
  let missedOffPaper = 0
  let inventedInSuggestions = 0
  for (const c of CASES) {
    const { data } = await reviewAnswer(llm, { question: c.question, answer: c.answer, profile, posting })
    const issues: string[] = []
    if (c.expect) {
      const off = (Object.keys(c.expect) as Array<keyof typeof c.expect>).filter((k) => data.star[k] !== c.expect![k])
      if (off.length) {
        wrongStar++
        issues.push(`STAR farkı: ${off.join(", ")}`)
      }
    }
    for (const n of c.offPaper ?? []) {
      if (!data.offPaper.some((o) => o.includes(`"${n}"`))) {
        missedOffPaper++
        issues.push(`kaçan sayı ${n}`)
      }
    }
    const invented = checkNumbers(data.improvements.join(" "), `${c.answer}\n${JSON.stringify(profile)}`)
    if (invented.length) {
      inventedInSuggestions++
      issues.push(`öneride yeni sayı: ${invented.map((i) => i.detail).join(" | ")}`)
    }
    console.log(`${c.name.padEnd(12)} ${issues.length ? issues.join(" · ") : "✓"}`)
    console.log(`   STAR ${JSON.stringify(data.star)} · ${data.words} kelime (${data.length})`)
    console.log(`   güçlü: ${data.strengths.join(" | ") || "—"}\n   geliştir: ${data.improvements.join(" | ")}\n   kağıtta yok: ${data.offPaper.join(" | ") || "—"}\n`)
  }
  console.log(`STAR farkı ${wrongStar} · kaçan "kağıtta yok" ${missedOffPaper} · önerilerde yeni sayı ${inventedInSuggestions}`)
}

void main()
