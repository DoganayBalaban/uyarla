import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildContribution } from "../src/adapt/contribution.js"
import { OpenAiCompatibleEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"

/**
 * "AI ile yaz" (DOG-94): kullanıcının cevabından madde.
 *
 * Ölçülen iki şey:
 *   - Uydurma: maddede cevapta olmayan sayı ya da ilan terimi (verify).
 *   - Ret: cevap deneyim anlatmıyorsa madde yazılmamalı (boş dönüş).
 * Vakalar elle yazıldı; bir kısmı modeli ilanın terimine kaydırmak için
 * bilerek belirsiz. Çıktılar runs/katki-<zaman>.json'a yazılıyor.
 *
 * Kullanım: pnpm eval:contribution
 */
const KOK = import.meta.dirname

const posting = (text: string, terms: string[]): JobPostingData => ({
  position: "x",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [{ text, type: "skill", importance: "must", concepts: terms.map((term) => ({ term, synonyms: [] })) }],
})

interface Case {
  name: string
  requirement: string
  terms: string[]
  answer: string
  /** Cevap deneyim anlatmıyor: madde yazılmamalı. */
  expectEmpty?: boolean
  language?: "tr" | "en"
}

const CASES: Case[] = [
  { name: "sadık-docker", requirement: "Docker ve Kubernetes deneyimi", terms: ["Docker", "Kubernetes"], answer: "staj projesinde docker compose ile 3 servisi ayağa kaldırdım" },
  { name: "belirsiz-k8s", requirement: "Kubernetes ile konteyner orkestrasyonu", terms: ["Kubernetes", "konteyner orkestrasyonu"], answer: "şirkette uygulamalarımızı bulutta çalıştırıyorduk, deploy süreçlerine yardım ettim" },
  { name: "rakamlı-satış", requirement: "B2B satış ve hedef yönetimi", terms: ["B2B satış", "hedef yönetimi"], answer: "kurumsal müşterilere yazılım lisansı sattım, 2023'te yıllık hedefin yüzde 110'unu tutturdum" },
  { name: "rakamsız-satış", requirement: "B2B satış ve hedef yönetimi", terms: ["B2B satış", "hedef yönetimi"], answer: "bayilere ürün satışı yaptım, hedeflerimizi genelde tutturuyorduk" },
  { name: "yapmadım", requirement: "SAP FI/CO modülü deneyimi", terms: ["SAP FI/CO"], answer: "sap kullanmadım ama logo tiger biliyorum", expectEmpty: true },
  { name: "bilmiyorum", requirement: "Power BI ile raporlama", terms: ["Power BI", "raporlama"], answer: "bilmiyorum ama öğrenmeye çok açığım", expectEmpty: true },
  { name: "anlamsız", requirement: "İngilizce yazışma", terms: ["İngilizce"], answer: "asdasd qweqwe zxczxc", expectEmpty: true },
  { name: "abartma-riski", requirement: "Ekip liderliği", terms: ["ekip liderliği"], answer: "yeni gelen iki stajyere işleri gösterdim, sorularını cevapladım" },
  { name: "ik-bordro", requirement: "Bordro süreçleri ve SGK bildirgeleri", terms: ["bordro", "SGK"], answer: "her ay 40 kişilik bordroyu hazırlayıp sgk aylık prim bildirgelerini e-bildirgeden gönderdim" },
  { name: "pazarlama-ga4", requirement: "GA4 ve Google Tag Manager hakimiyeti", terms: ["GA4", "Google Tag Manager"], answer: "sitede dönüşüm takibi için etiketleri kurdum, raporlara bakıyordum" },
  { name: "excel-makro", requirement: "İleri seviye Excel (makro, pivot)", terms: ["Excel", "makro", "pivot"], answer: "aylık stok raporunu excelde pivot tablolarla hazırladım" },
  { name: "ingilizce-cv", requirement: "Experience with CI/CD pipelines", terms: ["CI/CD"], answer: "i set up github actions to run tests and deploy to staging on every merge", language: "en" },
]

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  const rows: Array<Record<string, unknown>> = []
  let flagged = 0
  let wrongEmpty = 0

  for (const c of CASES) {
    const p = posting(c.requirement, c.terms)
    const r = await buildContribution(llm, embedding, { requirement: p.requirements[0]!, answer: c.answer, posting: p, language: c.language })
    const v = r.text ? r.verification : null
    if (v?.status === "flagged") flagged++
    if (c.expectEmpty !== undefined && c.expectEmpty !== !r.text) wrongEmpty++
    rows.push({ ...c, ...r })
    const mark = !r.text ? "—boş—" : v?.status === "flagged" ? `⚠ ${v.issues.map((i) => i.detail).join(" | ")}` : `ok (${r.decision})`
    const al = r.alignments.map((a) => `${a.term} ← "${a.basis}"`).join("; ")
    console.log(`${c.name.padEnd(16)} ${mark}\n   cevap: ${c.answer}\n   madde: ${r.text}${al ? `\n   uyum : ${al}` : ""}\n`)
  }

  console.log(`İşaretlenen: ${flagged}/${CASES.length} · beklenen boş/dolu hatası: ${wrongEmpty}`)
  mkdirSync(join(KOK, "runs"), { recursive: true })
  writeFileSync(join(KOK, "runs", `katki-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify(rows, null, 2))
}

void main()
