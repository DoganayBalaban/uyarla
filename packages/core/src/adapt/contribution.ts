import { z } from "zod"
import { cosineSimilarity } from "../llm/embedding.js"
import { containsKeyword } from "../normalize/turkish.js"
import type { EmbeddingProvider, ExtractResult, LlmProvider } from "../llm/types.js"
import type { Language } from "../normalize/language.js"
import type { TermAlignment, Verification } from "../schemas/adaptation.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { verifyAlignments } from "../verify/alignment.js"
import { verifyRewrite } from "../verify/verify.js"

/**
 * Kullanıcının anlattığı deneyimden CV maddesi (DOG-94).
 *
 * Uyarlama CV'de kanıtı olmayan gereksinime madde yazmıyor; bu doğru, ama
 * aday o işi gerçekten yapmış ve CV'ye yazmamış olabilir. Kalıp cümle
 * önermek (Jobscan'in ücretsiz kütüphanesi) uydurmaya kapı açar. Burada
 * kaynak kullanıcının kendi cevabı: model onu CV diline çeviriyor, kontrol
 * de cevaba karşı yapılıyor. Cevapta olmayan sayı ya da ilan terimi
 * maddeye girerse verify işaretliyor.
 */
export const CONTRIBUTION_PROMPT = `Sana bir iş ilanındaki TEK bir gereksinim ve adayın bu konudaki
deneyimini kendi sözleriyle anlattığı kısa bir metin verilecek.

Görevin: adayın anlattığını CV'ye girecek TEK bir deneyim maddesine çevirmek.

Kesin kurallar:
- Yalnızca adayın metninde yazanları kullan. Metinde olmayan hiçbir teknoloji,
  araç, sayı, süre, ekip büyüklüğü ya da sonuç EKLEME.
- Gereksinimin terimini YALNIZCA adayın metninde aynı şeyi anlatan bir ifade
  varsa kullan. Kullandığın her terim için o ifadeyi metinden BİREBİR kopyala
  ve "alignments" listesine { "term": terim, "basis": metindeki ifade } olarak
  yaz. Teknoloji ve ürün adlarını (Docker, Kubernetes, CI/CD, Power BI…)
  yalnızca aday o adı yazdıysa kullan; bunlar için dayanak gösterilemez.
- Metin terimi anlatmıyorsa terimi kullanma; adayın anlattığını olduğu gibi
  maddeleştir ve "alignments" listesini boş bırak.
- Metindeki teknoloji adlarını ve sayıları KORU; sayının neyi ölçtüğünü
  değiştirme.
- Neden-sonuç ilişkisi kurma: "X yaparak Y sağladım" ancak aday böyle
  anlattıysa yazılır.
- Abartma: "uzman", "ileri düzey", "lider" gibi nitelemeleri aday kendisi
  söylemediyse kullanma.
- Cümle dil bilgisi açısından eksiksiz ve doğal olsun; metni sıkıştırırken
  fiili ya da nesneyi düşürme.
- CV üslubunda, geçmiş zamanlı ve birinci tekil şahısla tek cümle yaz
  ("…kurdum", "…yönettim"). İngilizce yazıyorsan öznesiz yaz ("Built …").
- Girdideki "Dil" satırında yazan dilde yaz.
- Adayın metni bir deneyim anlatmıyorsa (ör. "bilmiyorum", "yapmadım",
  anlamsız metin) "rewritten" alanını BOŞ bırak.

Örnek:
Gereksinim: Docker ile konteyner yönetimi
Adayın metni: staj projesinde uygulamayı docker compose ile ayağa kaldırıyordum, 3 servis vardı
Çıktı: { "rewritten": "Staj projesinde 3 servisli uygulamayı Docker Compose ile ayağa kaldırdım.", "alignments": [] }
("konteyner yönetimi" yazılmadı: aday yönetimden değil, ayağa kaldırmaktan söz ediyor.)

Örnek:
Gereksinim: Raporlama ve veri analizi
Adayın metni: her hafta satış rakamlarını excelde özetleyip müdüre sunuyordum
Çıktı: { "rewritten": "Haftalık satış rakamlarını Excel'de özetleyip müdüre sunarak düzenli raporlama yaptım.",
         "alignments": [{ "term": "raporlama", "basis": "excelde özetleyip müdüre sunuyordum" }] }`

const ContributionOutputSchema = z.object({
  rewritten: z.string(),
  alignments: z.array(z.object({ term: z.string(), basis: z.string() })),
})
const contributionJsonSchema = toJsonSchema(ContributionOutputSchema)
/** Okuma hoşgörülü: alanı atlayan yanıt uyumsuz sayılır (adapt/rewrite.ts gibi). */
const ContributionParseSchema = ContributionOutputSchema.extend({
  alignments: ContributionOutputSchema.shape.alignments.default([]),
})

const LANGUAGE_NAME: Record<Language, string> = { tr: "Türkçe", en: "İngilizce" }

/** Bundan kısa cevap bir deneyim anlatamaz; LLM'e gönderilmeden reddediliyor. */
export const MIN_ANSWER_LENGTH = 20
export const MAX_ANSWER_LENGTH = 600

export interface ContributionTask {
  /** Gereksinimin ilandaki hâli. */
  requirement: string
  answer: string
  language?: Language
}

/**
 * Cevabı maddeye çevirir. Model cevabı deneyim saymadıysa `text` boş döner;
 * çağıran bunu "maddeye çeviremedik" diye kullanıcıya söylemeli.
 */
export async function writeContribution(
  llm: LlmProvider,
  task: ContributionTask,
): Promise<ExtractResult<{ text: string; alignments: TermAlignment[] }>> {
  const { data, tokens } = await llm.extract({
    prompt: CONTRIBUTION_PROMPT,
    schemaName: "user_contribution",
    schema: contributionJsonSchema,
    input: [
      `Gereksinim: ${task.requirement}`,
      `Adayın metni: ${task.answer.trim()}`,
      `Dil: ${LANGUAGE_NAME[task.language ?? "tr"]}`,
    ].join("\n"),
  })
  const parsed = ContributionParseSchema.parse(data)
  return { data: { text: parsed.rewritten.trim(), alignments: parsed.alignments }, tokens }
}

/**
 * Maddeyi kullanıcının cevabına karşı doğrular: sayılar cevapta var mı,
 * ilanın cevapta geçmeyen bir terimi maddeye sokulmuş mu. Kaynak CV değil
 * cevap; adayın CV'sine yazmadığı ama anlattığı şey zaten bu.
 */
export function verifyContribution(
  text: string,
  answer: string,
  posting: JobPostingData,
  allowedTerms: readonly string[] = [],
): Verification {
  return verifyRewrite({ rewritten: text, source: answer, posting, allowedTerms })
}

export interface BuiltContribution {
  /** Boşsa cevap bir deneyim anlatmıyor; madde eklenmez. */
  text: string
  alignments: TermAlignment[]
  verification: Verification
  /**
   * Uyarısız ve terim uyumsuzsa "accepted". Terim uyumu varsa kullanıcı o
   * terimin deneyimini anlattığını onaylamalı (normal maddelerdeki gibi,
   * adapt/draft.ts); uyarılıysa da karar onda: anlatılan onun deneyimi.
   */
  decision: "accepted" | "pending"
  tokens: number
}

/**
 * Katkının tamamı: yazım, terim uyumlarının doğrulanması (dayanak cevapta
 * birebir geçiyor ve anlamca yakın, verify/alignment.ts), uydurma kontrolü.
 */
export async function buildContribution(
  llm: LlmProvider,
  embedding: EmbeddingProvider,
  input: { requirement: Requirement; answer: string; posting: JobPostingData; language?: Language },
): Promise<BuiltContribution> {
  const { data, tokens } = await writeContribution(llm, {
    requirement: input.requirement.text,
    answer: input.answer,
    language: input.language,
  })
  if (!data.text) {
    return { text: "", alignments: [], verification: { status: "ok", issues: [] }, decision: "accepted", tokens }
  }

  // Model terimi bildirip cümlede kullanmayabiliyor (eval: "hedef yönetimi").
  // Kullanılmayan terimin onayını istemek anlamsız; yalnızca metinde
  // geçenler uyum sayılıyor.
  const claims = data.alignments.filter((a) => containsKeyword(data.text, a.term))
  const vecs = claims.length > 0 ? await embedding.embed([...claims.map((a) => a.term), ...claims.map((a) => a.basis)]) : []
  const verified = verifyAlignments({
    alignments: claims,
    source: input.answer,
    targets: input.requirement.concepts,
    similarities: claims.map((_, i) => {
      const a = vecs[i]
      const b = vecs[claims.length + i]
      return a && b ? cosineSimilarity(a, b) : 0
    }),
  })

  const verification = verifyContribution(
    data.text,
    input.answer,
    input.posting,
    verified.map((v) => v.concept.term),
  )
  const alignments = verified.map(({ term, basis }) => ({ term, basis }))
  const decision = verification.status === "ok" && alignments.length === 0 ? "accepted" : "pending"
  return { text: data.text, alignments, verification, decision, tokens }
}
