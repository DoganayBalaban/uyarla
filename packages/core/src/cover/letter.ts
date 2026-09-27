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

const CoverLetterSchema = z.object({ paragraflar: z.array(z.string()) })
const coverLetterJsonSchema = toJsonSchema(CoverLetterSchema)

export interface OnYaziParagrafi {
  metin: string
  kontrol: Verification
}

export interface OnYazi {
  paragraflar: OnYaziParagrafi[]
}

/** Adaptation.coverLetter sütununda saklanan hâl. */
export type OnYaziKaydi =
  | { durum: "running" }
  | { durum: "failed" }
  | { durum: "done"; paragraflar: OnYaziParagrafi[]; tokenUsage: number; olusturulma: string }

/**
 * CV'nin modele ve kontrole verilen metni. Kontrolün kaynağı da bu:
 * modelin gördüğü şeyle kontrolün karşılaştırdığı şey aynı olmalı.
 */
export function cvOlgulari(profile: ResumeProfile): string {
  const satirlar: string[] = []
  if (profile.fullName) satirlar.push(`Ad: ${profile.fullName}`)
  if (profile.headline) satirlar.push(`Unvan: ${profile.headline}`)
  if (profile.summary) satirlar.push(`Özet: ${profile.summary}`)

  for (const d of profile.experience) {
    satirlar.push(`Deneyim: ${d.title} — ${d.company} (${d.startDate} – ${d.endDate})`)
    for (const m of d.bullets) satirlar.push(`  • ${m.sourceRef || m.text}`)
  }
  for (const e of profile.education) {
    const parca = [e.school, e.degree, e.field, e.endDate].filter(Boolean).join(", ")
    satirlar.push(`Eğitim: ${parca}`)
  }
  if (profile.skills.length) satirlar.push(`Beceriler: ${profile.skills.join(", ")}`)
  if (profile.languages.length) satirlar.push(`Diller: ${profile.languages.join(", ")}`)
  if (profile.certifications.length) {
    satirlar.push(`Sertifikalar: ${profile.certifications.join(", ")}`)
  }
  return satirlar.join("\n")
}

function ilanOzeti(posting: JobPostingData): string {
  const zorunlu = posting.requirements.filter((r) => r.importance === "must").map((r) => r.text)
  const tercihen = posting.requirements.filter((r) => r.importance !== "must").map((r) => r.text)
  return [
    `Pozisyon: ${posting.position}`,
    posting.company ? `Şirket: ${posting.company}` : null,
    `Dil: ${posting.language === "en" ? "İngilizce" : "Türkçe"}`,
    zorunlu.length ? `Zorunlu gereksinimler:\n- ${zorunlu.join("\n- ")}` : null,
    tercihen.length ? `Tercih edilenler:\n- ${tercihen.join("\n- ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * Kontrolün mesajları madde yeniden yazımı için yazılmış ("Bu maddede …
 * senin yazdığın hâlinde yok"); ön yazıda kaynak maddenin kendisi değil,
 * CV'nin tamamı.
 */
function paragrafMesaji(detay: string): string {
  return detay.replace("Bu maddede", "Bu paragrafta").replace("senin yazdığın hâlinde", "CV'nde")
}

export function verifyCoverLetter(
  paragraflar: string[],
  kaynak: string,
  posting: JobPostingData,
): OnYaziParagrafi[] {
  return paragraflar.map((metin) => {
    const issues = [
      ...checkNumbers(metin, kaynak),
      ...checkPostingTermInjection(metin, kaynak, posting),
    ].map((i) => ({ ...i, detail: paragrafMesaji(i.detail) }))
    return { metin, kontrol: { status: issues.length ? "flagged" : "ok", issues } }
  })
}

export async function generateCoverLetter(
  llm: LlmProvider,
  input: { profile: ResumeProfile; posting: JobPostingData },
): Promise<ExtractResult<OnYazi>> {
  const kaynak = cvOlgulari(input.profile)
  const { data, tokens } = await llm.extract({
    prompt: COVER_LETTER_PROMPT,
    schemaName: "cover_letter",
    schema: coverLetterJsonSchema,
    input: `CV BİLGİLERİ\n${kaynak}\n\nİŞ İLANI\n${ilanOzeti(input.posting)}`,
  })

  const paragraflar = CoverLetterSchema.parse(data)
    .paragraflar.map((p) => p.trim())
    .filter(Boolean)

  return { data: { paragraflar: verifyCoverLetter(paragraflar, kaynak, input.posting) }, tokens }
}
