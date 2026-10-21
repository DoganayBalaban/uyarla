import { z } from "zod"
import { resumeFacts } from "../cover/letter.js"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { normalizeText } from "../normalize/turkish.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { withoutNegatedClauses } from "../verify/negation.js"
import { checkNumbers } from "../verify/numbers.js"
import type { TransferableItem } from "./transferableRecord.js"

export { MAX_TRANSFERABLE_ATTEMPTS, readTransferable, type TransferableItem, type TransferableRecord } from "./transferableRecord.js"

/**
 * Aktarılabilir deneyim (DOG-100). Kariyer değiştiren aday için: CV'de
 * karşılığı olmayan zorunlu gereksinime, başka bağlamda yapılmış ama
 * aktarılabilir bir deneyim var mı.
 *
 * Gömme benzerliğiyle değil: eşiğin altındaki "yakın" eşleşmeler ölçümde
 * çoğunlukla gürültüydü (20 çiftte 74 yakın eşleşmenin ~10'u gerçek; alan
 * değiştiren CV'lerde neredeyse hiçbiri, ör. "İşe alım" ← "fatura kesimi").
 * LLM gerekçe yazıyor; kanıt CV'den BİREBİR madde olmalı, değilse öneri
 * düşüyor. Gerekçedeki CV'de olmayan sayı işaretleniyor. Skora katılmıyor.
 */

const TRANSFERABLE_PROMPT = `Sana bir adayın CV'si ve CV'de karşılığı bulunmayan zorunlu iş ilanı
gereksinimleri verilecek. Aday başka bir alandan geliyor olabilir. Her
gereksinim için CV'de ona AKTARILABİLECEK bir deneyim var mı bak.

Kesin kurallar:
- "alinti": CV'de "•" ile başlayan ilgili MADDE satırını, madde işareti
  olmadan HARFİ HARFİNE kopyala. Unvan, tarih, beceri listesi ya da özet
  cümlesi alıntı değildir. Uygun madde yoksa null.
- Yalnızca gerçekten aktarılabilir olanı seç: aynı becerinin başka bir
  bağlamda kullanılması (ör. müşteriyle fiyat görüşmesi → tedarikçiyle
  pazarlık) ya da maddede yapılan işin gereksinimin konusuna doğrudan
  dokunması (ör. bir mevzuata göre belge hazırlamak → o mevzuatı bilmek).
  Konu benzerliği, aynı kelimenin geçmesi ya da aynı sektörde çalışmış olmak
  tek başına yetmez. Emin değilsen null.
- "gerekce": tek cümle; maddedeki hangi işin gereksinimin hangi kısmına
  karşılık geldiğini somut söyle. "Adaptasyon yeteneği", "öğrenmeye açıklık"
  gibi genel kişilik iddiaları gerekçe değildir; öyleyse alıntı da null.
  Gereksinimi SAHİPLENME ("X deneyimim var" deme). CV'de olmayan sayı, süre,
  araç ya da sorumluluk yazma. Alıntı null ise gerekçe de null.
- Her gereksinim için bir kayıt; "sira" gereksinimin numarası.
- Dil: girdideki "Dil" satırında yazan dil. Türkçe ise "sen" dili.`

const TransferableSchema = z.object({
  kopruler: z.array(z.object({ sira: z.number().int(), alinti: z.string().nullable(), gerekce: z.string().nullable() })),
})
const transferableJsonSchema = toJsonSchema(TransferableSchema)

export interface TransferableInput {
  profile: ResumeProfile
  posting: JobPostingData
  /** CV'de karşılığı olmayan zorunlu gereksinimler, analizdeki sırasıyla. */
  missingMust: Array<{ index: number; text: string }>
}

/** CV maddeleri (deneyim ve proje); kanıt yalnızca bunlardan. */
function bulletList(profile: ResumeProfile) {
  return [...profile.experience.flatMap((j) => j.bullets), ...(profile.projects ?? []).flatMap((p) => p.bullets)]
}

/** Kaynak metin: ön yazıdaki CV özeti, artı proje maddeleri (orada yok). */
function sourceText(profile: ResumeProfile): string {
  const projects = (profile.projects ?? []).flatMap((p) => [`Proje: ${p.name}`, ...p.bullets.map((b) => `  • ${b.sourceRef || b.text}`)])
  return [resumeFacts(profile), ...projects].join("\n")
}

export async function findTransferable(llm: LlmProvider, input: TransferableInput): Promise<ExtractResult<TransferableItem[]>> {
  if (input.missingMust.length === 0) return { data: [], tokens: 0 }
  const source = sourceText(input.profile)
  const { data, tokens } = await llm.extract({
    prompt: TRANSFERABLE_PROMPT,
    schemaName: "transferable_experience",
    schema: transferableJsonSchema,
    input: [
      `CV\n${source}`,
      `İLAN\nPozisyon: ${input.posting.position}\nDil: ${input.posting.language === "en" ? "İngilizce" : "Türkçe"}`,
      `CV'DE KARŞILIĞI OLMAYAN ZORUNLU GEREKSİNİMLER\n${input.missingMust.map((m, i) => `${i + 1}. ${m.text}`).join("\n")}`,
    ].join("\n\n"),
  })
  const parsed = TransferableSchema.parse(data)
  return { data: toItems(parsed.kopruler, input, source), tokens }
}

/**
 * Modelin cevabını doğrular. Alıntı CV'de birebir madde değilse öneri
 * düşüyor (gerekçe de); model maddeyi özgün metinden (sourceRef) de
 * kopyalayabiliyor, ikisi de tanınıyor, gösterilen maddenin kendisi.
 */
export function toItems(
  answers: Array<{ sira: number; alinti: string | null; gerekce: string | null }>,
  input: TransferableInput,
  source: string,
): TransferableItem[] {
  const byKey = new Map<string, string>()
  for (const b of bulletList(input.profile)) {
    byKey.set(normalizeText(b.text), b.text)
    if (b.sourceRef) byKey.set(normalizeText(b.sourceRef), b.text)
  }
  return input.missingMust.map((m, i) => {
    const answer = answers.find((a) => a.sira === i + 1)
    const quote = answer?.alinti ? (byKey.get(normalizeText(answer.alinti)) ?? null) : null
    const reason = quote && answer?.gerekce?.trim() ? answer.gerekce.trim() : null
    if (!quote || !reason) return { requirementIndex: m.index, requirement: m.text, quote: null, reason: null, verification: null }
    // Gerekçe gereksinimi anıyor; ilan terimi kontrolü her gerekçeyi
    // işaretlerdi. Sayı kontrolü kalıyor ("3 yıl" gibi CV'de olmayan süre).
    const issues = checkNumbers(withoutNegatedClauses(reason), source)
    return {
      requirementIndex: m.index,
      requirement: m.text,
      quote,
      reason,
      verification: { status: issues.length ? "flagged" : "ok", issues },
    }
  })
}
