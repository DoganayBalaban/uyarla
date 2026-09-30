import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { Language as Language } from "../normalize/language.js"
import type { JobPostingData } from "../schemas/job.js"
import type { TermAlignment } from "../schemas/adaptation.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { BULLET_PROMPT, SUMMARY_PROMPT } from "./prompts.js"

const SummarySchema = z.object({ rewritten: z.string() })
const summaryJsonSchema = toJsonSchema(SummarySchema)

const BulletSchema = z.object({
  rewritten: z.string(),
  alignments: z.array(z.object({ term: z.string(), basis: z.string() })),
})
const bulletJsonSchema = toJsonSchema(BulletSchema)
/**
 * Okuma şeması hoşgörülü: şema kısıtı modele `alignments`'ı zorunlu
 * gönderiyor, ama alanı atlayan bir yanıt maddeyi patlatmamalı; uyum yok
 * sayılır ve terim kullandıysa enjeksiyon kontrolü yakalar.
 */
const BulletParseSchema = BulletSchema.extend({
  alignments: BulletSchema.shape.alignments.default([]),
})

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

export interface BulletTask {
  bullet: string
  /** Modele gösterilecek ilan terimleri (adapt/targets.ts). */
  targets: string[]
  /** CV'nin dili; yazım bu dilde kalır (K-39). Verilmezse Türkçe. */
  language?: Language
}

const LANGUAGE_NAME: Record<Language, string> = { tr: "Türkçe", en: "İngilizce" }

export interface BulletRewrite {
  text: string
  /** Modelin iddia ettiği terim-dayanak eşlemeleri; henüz doğrulanmamış. */
  alignments: TermAlignment[]
}

/**
 * Tek bir maddeyi ilanın terimleriyle hizalar.
 *
 * Hedefi olmayan madde modele hiç gönderilmiyor ve olduğu gibi dönüyor:
 * hedefsiz yazım uçtan uca testte yalnızca eş anlamlı kelime değişikliği
 * üretti, skora katkısı sıfırdı (K-38). Bu aynı zamanda LLM çağrısı tasarrufu.
 */
export async function rewriteBullet(
  llm: LlmProvider,
  task: BulletTask,
): Promise<ExtractResult<BulletRewrite>> {
  if (task.targets.length === 0) {
    return { data: { text: task.bullet, alignments: [] }, tokens: 0 }
  }

  const { data, tokens } = await llm.extract({
    prompt: BULLET_PROMPT,
    schemaName: "aligned_bullet",
    schema: bulletJsonSchema,
    input: [
      `Madde: ${task.bullet}`,
      `İlanın terimleri: ${task.targets.join(", ")}`,
      `Dil: ${LANGUAGE_NAME[task.language ?? "tr"]}`,
    ].join("\n"),
  })
  const outcome = BulletParseSchema.parse(data)
  // Boş dönüş maddeyi silmek anlamına gelirdi; orijinal korunur.
  const content = outcome.rewritten.trim()
  return {
    data: content
      ? { text: content, alignments: outcome.alignments }
      : { text: task.bullet, alignments: [] },
    tokens,
  }
}

export async function rewriteSummary(
  llm: LlmProvider,
  input: {
    summary: string
    posting: JobPostingData
    /** CV'de kelimesi geçen ilan kavramları (supportedConceptTerms). */
    supportedTerms: string[]
    /** CV'nin dili; özet bu dilde kalır (K-39). Verilmezse Türkçe. */
    language?: Language
  },
): Promise<ExtractResult<string>> {
  const content = [
    `Özet: ${input.summary}`,
    `Pozisyon: ${input.posting.position}`,
    `CV'de geçen ve ilanın aradığı kavramlar: ${input.supportedTerms.join(", ") || "—"}`,
    `Dil: ${LANGUAGE_NAME[input.language ?? "tr"]}`,
  ].join("\n")

  const { data, tokens } = await llm.extract({
    prompt: SUMMARY_PROMPT,
    schemaName: "rewritten_summary",
    schema: summaryJsonSchema,
    input: content,
  })
  const { rewritten } = SummarySchema.parse(data)
  return { data: rewritten.trim() || input.summary, tokens }
}

/**
 * Aynı anda en fazla bu kadar madde çağrısı.
 *
 * LM Studio istekleri kuyruğa alıyor (K-16) ve zaman aşımı istek
 * gönderildiği anda başlıyor. Sınırsız paralellikte 20 maddelik bir CV'nin
 * son maddeleri sırada beklerken zaman aşımına düşer ve sessizce `null`
 * olurdu.
 */
export const DEFAULT_REWRITE_CONCURRENCY = 4

/**
 * Maddeleri sınırlı paralellikle yazar; patlayan madde `null` döner.
 * Bir maddenin patlaması diğerlerini düşürmemeli (spec §13).
 */
export async function rewriteBullets(
  llm: LlmProvider,
  tasks: BulletTask[],
  concurrency: number = DEFAULT_REWRITE_CONCURRENCY,
): Promise<Array<ExtractResult<BulletRewrite> | null>> {
  const outcomes: Array<ExtractResult<BulletRewrite> | null> = new Array(tasks.length).fill(null)
  let orderIndex = 0

  // Her işçi sıradaki maddeyi alır; sonuç kendi indeksine yazılır, böylece
  // çıktı sırası girdi sırasıyla aynı kalır.
  const worker = async (): Promise<void> => {
    while (orderIndex < tasks.length) {
      const i = orderIndex++
      try {
        outcomes[i] = await rewriteBullet(llm, tasks[i]!)
      } catch {
        outcomes[i] = null
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length))
  await Promise.all(Array.from({ length: workerCount }, worker))
  return outcomes
}
