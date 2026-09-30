import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { checkNumbers } from "../verify/numbers.js"
import { checkPostingTermInjection } from "../verify/injection.js"

/**
 * Ön yazı.
 *
 * Uyarlamanın uydurmama ilkesi burada da bağlayıcı, ama iş daha zor: madde
 * yeniden yazımında kaynak tek bir cümle, ön yazıda ise serbest metin. Bu
 * yüzden iki katman var:
 *
 *   1. Model yalnızca CV'deki olguları görüyor ve kurallar açık.
 *   2. Üretilen her paragraf madde yeniden yazımıyla AYNI deterministik
 *      kontrollerden geçiyor: CV'de olmayan sayı ve CV'de olmayan ilan
 *      kavramı işaretleniyor (K-28: yargıyı modele bırakmıyoruz).
 *
 * İlanın gereksinimleri modele veriliyor — madde yeniden yazımından farklı
 * olarak (bkz. BULLET_PROMPT gerekçesi). Ön yazının işi "bu ilana neden
 * uygunum" demek; ilanı görmeden yazılamaz. Enjeksiyon riski kontrol
 * katmanında yakalanıyor.
 */

export const COVER_LETTER_PROMPT = `Sana bir adayın CV bilgileri ve başvurduğu iş ilanı verilecek.
Bu ilana özel, kısa bir ön yazı yaz.

Kesin kurallar:
- YALNIZCA CV bilgilerinde yazan deneyim, beceri, okul ve sayıları kullan.
- CV'de olmayan bir teknoloji, araç, sertifika, unvan veya sorumluluk YAZMA.
  İlan istiyor olsa bile.
- CV'de olmayan hiçbir sayı yazma (yıl, yüzde, adet, deneyim süresi).
- İlanın istediği bir şey CV'de yoksa ondan hiç bahsetme; yalan söyleme,
  özür de dileme.
- Abartma: "katkı sağladım" ise "yönettim" yazma.

Biçim:
- 3 paragraf, toplam 150–250 kelime.
- 1. paragraf: hangi pozisyona başvurduğu ve neden ilgilendiği, bir iki cümle.
- 2. paragraf: CV'deki en ilgili 2–3 deneyimi ilanın ihtiyacıyla somut
  olarak eşleştir.
- 3. paragraf: kısa kapanış ve görüşme isteği.
- Hitap ve imza YAZMA; yalnızca üç paragrafın metni.
- İlan hangi dildeyse o dilde yaz. Türkçe ise resmi "siz" dili kullan.`

// Anahtar LLM ile yapılan sözleşmenin parçası (prompt gibi); Türkçe kalıyor.
const CoverLetterSchema = z.object({ paragraflar: z.array(z.string()) })
const coverLetterJsonSchema = toJsonSchema(CoverLetterSchema)

export interface CoverLetterParagraph {
  text: string
  verification: Verification
}

export interface CoverLetter {
  paragraphs: CoverLetterParagraph[]
}

/** Adaptation.coverLetter sütununda saklanan hâl. */
export type CoverLetterRecord =
  | { status: "running" }
  | { status: "failed" }
  | { status: "done"; paragraphs: CoverLetterParagraph[]; tokenUsage: number; createdAt: string }

/**
 * CV'nin modele ve kontrole verilen metni. Kontrolün kaynağı da bu:
 * modelin gördüğü şeyle kontrolün karşılaştırdığı şey aynı olmalı.
 */
export function resumeFacts(profile: ResumeProfile): string {
  const lineItems: string[] = []
  if (profile.fullName) lineItems.push(`Ad: ${profile.fullName}`)
  if (profile.headline) lineItems.push(`Unvan: ${profile.headline}`)
  if (profile.summary) lineItems.push(`Özet: ${profile.summary}`)

  for (const d of profile.experience) {
    lineItems.push(`Deneyim: ${d.title} — ${d.company} (${d.startDate} – ${d.endDate})`)
    for (const m of d.bullets) lineItems.push(`  • ${m.sourceRef || m.text}`)
  }
  for (const e of profile.education) {
    const fragment = [e.school, e.degree, e.field, e.endDate].filter(Boolean).join(", ")
    lineItems.push(`Eğitim: ${fragment}`)
  }
  if (profile.skills.length) lineItems.push(`Beceriler: ${profile.skills.join(", ")}`)
  if (profile.languages.length) lineItems.push(`Diller: ${profile.languages.join(", ")}`)
  if (profile.certifications.length) {
    lineItems.push(`Sertifikalar: ${profile.certifications.join(", ")}`)
  }
  return lineItems.join("\n")
}

function postingSummary(posting: JobPostingData): string {
  const required = posting.requirements.filter((r) => r.importance === "must").map((r) => r.text)
  const preferred = posting.requirements.filter((r) => r.importance !== "must").map((r) => r.text)
  return [
    `Pozisyon: ${posting.position}`,
    posting.company ? `Şirket: ${posting.company}` : null,
    `Dil: ${posting.language === "en" ? "İngilizce" : "Türkçe"}`,
    required.length ? `Zorunlu gereksinimler:\n- ${required.join("\n- ")}` : null,
    preferred.length ? `Tercih edilenler:\n- ${preferred.join("\n- ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Kontrolün mesajları madde yeniden yazımı için yazılmış ("Bu maddede …
 * senin yazdığın hâlinde yok"); ön yazıda kaynak maddenin kendisi değil,
 * CV'nin tamamı.
 */
function paragraphMessage(detailText: string): string {
  return detailText.replace("Bu maddede", "Bu paragrafta").replace("senin yazdığın hâlinde", "CV'nde")
}

export function verifyCoverLetter(
  paragraphs: string[],
  sourceText: string,
  posting: JobPostingData,
): CoverLetterParagraph[] {
  return paragraphs.map((paragraph) => {
    const issues = [
      ...checkNumbers(paragraph, sourceText),
      ...checkPostingTermInjection(paragraph, sourceText, posting),
    ].map((i) => ({ ...i, detail: paragraphMessage(i.detail) }))
    return { text: paragraph, verification: { status: issues.length ? "flagged" : "ok", issues } }
  })
}

export async function generateCoverLetter(
  llm: LlmProvider,
  input: { profile: ResumeProfile; posting: JobPostingData },
): Promise<ExtractResult<CoverLetter>> {
  const sourceText = resumeFacts(input.profile)
  const { data, tokens } = await llm.extract({
    prompt: COVER_LETTER_PROMPT,
    schemaName: "cover_letter",
    schema: coverLetterJsonSchema,
    input: `CV BİLGİLERİ\n${sourceText}\n\nİŞ İLANI\n${postingSummary(input.posting)}`,
  })

  const paragraphs = CoverLetterSchema.parse(data)
    .paragraflar.map((p) => p.trim())
    .filter(Boolean)

  return { data: { paragraphs: verifyCoverLetter(paragraphs, sourceText, input.posting) }, tokens }
}
