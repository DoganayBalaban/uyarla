import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { BULLET_PROMPT, SUMMARY_PROMPT } from "./prompts.js"

const RewriteSchema = z.object({ rewritten: z.string() })
const rewriteJsonSchema = toJsonSchema(RewriteSchema)

/**
 * İlanın `must` gereksinimlerindeki kavramlar, tekilleştirilmiş.
 *
 * Yalnızca `must`: modele verilen bağlam ne kadar darsa uydurma ihtimali o
 * kadar düşük, ve "tercihen" kavramlarını hedeflemenin kazancı yok.
 */
export function mustConceptTerms(posting: JobPostingData): string[] {
  return [
    ...new Set(
      posting.requirements
        .filter((r) => r.importance === "must")
        .flatMap((r) => r.concepts.map((c) => c.term)),
    ),
  ]
}

async function callRewrite(
  llm: LlmProvider,
  prompt: string,
  schemaName: string,
  input: string,
  fallback: string,
): Promise<ExtractResult<string>> {
  const { data, tokens } = await llm.extract({
    prompt,
    schemaName,
    schema: rewriteJsonSchema,
    input,
  })
  const { rewritten } = RewriteSchema.parse(data)
  // Boş dönüş maddeyi silmek anlamına gelirdi; orijinal korunur.
  return { data: rewritten.trim() || fallback, tokens }
}

/**
 * Tek bir maddeyi yeniden ifade eder.
 *
 * `posting` imzada duruyor ama modele VERİLMİYOR — bkz. BULLET_PROMPT'un
 * üstündeki gerekçe. Parametre, çağıranların hattı değiştirmeden ölçüm
 * yapabilmesi için korunuyor.
 */
export async function rewriteBullet(
  llm: LlmProvider,
  input: { bullet: string; posting: JobPostingData },
): Promise<ExtractResult<string>> {
  return callRewrite(
    llm,
    BULLET_PROMPT,
    "rewritten_bullet",
    `Madde: ${input.bullet}`,
    input.bullet,
  )
}

export async function rewriteSummary(
  llm: LlmProvider,
  input: { summary: string; posting: JobPostingData },
): Promise<ExtractResult<string>> {
  const kavramlar = mustConceptTerms(input.posting)
  const metin = [
    `Özet: ${input.summary}`,
    `Pozisyon: ${input.posting.position}`,
    `İlanın aradığı kavramlar: ${kavramlar.join(", ") || "—"}`,
  ].join("\n")

  return callRewrite(llm, SUMMARY_PROMPT, "rewritten_summary", metin, input.summary)
}

/**
 * Aynı anda en fazla bu kadar madde çağrısı.
 *
 * LM Studio istekleri kuyruğa alıyor (K-16) ve zaman aşımı istek
 * gönderildiği anda başlıyor. Sınırsız paralellikte 20 maddelik bir CV'nin
 * son maddeleri sırada beklerken zaman aşımına düşer ve sessizce `null`
 * olurdu. Değer Görev 14'te ölçülecek.
 */
export const DEFAULT_REWRITE_CONCURRENCY = 4

/**
 * Maddeleri sınırlı paralellikle yeniden yazar; patlayan madde `null` döner.
 *
 * Paralellik kazancı ölçülmeli: Sprint 1'de üç eşzamanlı büyük çağrı yalnızca
 * 1,29x kazandırmıştı (K-16). Madde çağrıları küçük ve davranış farklı
 * olabilir — Görev 14 bunu ölçüyor.
 *
 * Bir maddenin patlaması diğerlerini düşürmemeli (spec §13).
 */
export async function rewriteBullets(
  llm: LlmProvider,
  bullets: string[],
  posting: JobPostingData,
  concurrency: number = DEFAULT_REWRITE_CONCURRENCY,
): Promise<Array<ExtractResult<string> | null>> {
  const sonuclar: Array<ExtractResult<string> | null> = new Array(bullets.length).fill(null)
  let sira = 0

  // Her işçi sıradaki maddeyi alır; sonuç kendi indeksine yazılır, böylece
  // çıktı sırası girdi sırasıyla aynı kalır.
  const isci = async (): Promise<void> => {
    while (sira < bullets.length) {
      const i = sira++
      try {
        sonuclar[i] = await rewriteBullet(llm, { bullet: bullets[i]!, posting })
      } catch {
        sonuclar[i] = null
      }
    }
  }

  const isciSayisi = Math.max(1, Math.min(concurrency, bullets.length))
  await Promise.all(Array.from({ length: isciSayisi }, isci))
  return sonuclar
}
