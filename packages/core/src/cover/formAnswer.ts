import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { postingSummary, resumeFacts, verifyCoverLetter } from "./letter.js"
import { measure, type FormAnswerLimit } from "./formAnswerRecord.js"

export * from "./formAnswerRecord.js"

/**
 * Başvuru formu yanıtı (DOG-123). ai-job-search'ün portal formu çıktısı:
 * "kendini tanıt", "140 karakterde neden sen", "neden bu şirket" gibi
 * sorular. Kural ön yazıyla aynı: forma yeni iddia girmez, yanıt gönderilen
 * belgelerden seçilir; doğrulama da aynı (sayı ve ilan terimi).
 *
 * Sınır kodda denetleniyor: model aşarsa bir kez "şu kadar fazla, kısalt"
 * deniyor; yine aşarsa yanıt sınırın içindeki son tam cümlede kesiliyor.
 */
export const FORM_ANSWER_PROMPT = `Sana bir adayın bir iş başvurusunda GÖNDERDİĞİ belgeler (CV ve varsa ön yazı),
başvurduğu ilan ve başvuru formundaki BİR soru verilecek. Adayın bu forma
yapıştıracağı yanıtı yaz. Yanıtı aday gönderecek.

Kesin kurallar:
- YALNIZCA gönderilen belgelerde yazan deneyim, beceri ve sayıları kullan. Yeni
  bir deneyim, beceri, sayı, sonuç ya da iddia EKLEME.
- Süreyi ya da yıl sayısını tarihlerden HESAPLAMA ("3+ yıl", "2 yıldır"
  yazma); yalnızca belgelerde aynen yazıyorsa kullan.
- İlanın istediği bir şey belgelerde yoksa onu SAHİPLENME ("deneyimim var",
  "biliyorum" yazma). Soru doğrudan onu sormuyorsa eksiklerden HİÇ söz etme;
  yanıtı belgelerdeki güçlü yanlarla kur.
- Şirket hakkında YALNIZCA ilanda yazanı kullan. Adayın şirkete ilgisini,
  şirketi takip ettiğini, heyecanını ya da kişisel gerekçesini UYDURMA.
  Soru bunu soruyorsa belgelerden ilanla örtüşen deneyimi yaz ve kişisel
  gerekçenin yerine metne aynen "[kendi gerekçen]" yer tutucusunu koy.
- Klişe kullanma ("takım oyuncusu", "dinamik", "motivasyonu yüksek",
  "kendimi geliştirmeye açığım"); somut bir deneyim yaz.
- Soruyu doğrudan yanıtla; selamlama, imza, başlık yok. Birinci tekil şahıs.
- Yanıtın TAMAMI "YANIT DİLİ" satırındaki dilde olsun (sorunun dili; ilanın
  dili farklı olabilir). Teknik terimler ve araç adları aynen kalabilir.
- Uzunluk: "SINIR" satırı varsa onun altında kal (hedef sınırın yaklaşık
  %85'i). Yoksa 50–120 kelime.`

const AnswerSchema = z.object({ yanit: z.string() })
const answerJsonSchema = toJsonSchema(AnswerSchema)

export interface FormAnswerInput {
  profile: ResumeProfile
  coverLetter?: string[]
  posting: JobPostingData
  question: string
  limit: FormAnswerLimit | null
}

export interface FormAnswer {
  text: string
  verification: Verification
  overLimit: boolean
}

const UNIT_LABEL = { chars: "karakter", words: "kelime" } as const

/**
 * Sorunun dili. Model yanıtı ilanın diline kaydırıyordu (İngilizce ilanda
 * Türkçe soruya İngilizce yanıt); dil kodda belirlenip açıkça söyleniyor.
 */
export function questionLanguage(question: string): "tr" | "en" {
  if (/[çğışöüÇĞİŞÖÜ]/.test(question)) return "tr"
  const words = question.toLocaleLowerCase("tr").match(/[a-z]+/g) ?? []
  const tr = words.filter((w) => /^(ve|bir|bu|neden|nasıl|ne|için|ile|mi|mı|mu|mü|misiniz|musunuz|kendinizi|bize|anlatın|nedir)$/.test(w)).length
  const en = words.filter((w) => /^(the|and|why|what|how|you|your|do|are|is|for|with|tell|us|describe)$/.test(w)).length
  return en > tr ? "en" : "tr"
}

/** Sınırın içindeki son tam cümle; hiçbir cümle sığmıyorsa null. */
export function cutToLimit(text: string, limit: FormAnswerLimit): string | null {
  const sentences = text.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g) ?? [text]
  let out = ""
  for (const s of sentences) {
    const next = out + s
    if (measure(next.trim(), limit.unit) > limit.max) break
    out = next
  }
  return out.trim() || null
}

function formSource(input: FormAnswerInput): string {
  return [
    `GÖNDERİLEN CV\n${resumeFacts(input.profile)}`,
    input.coverLetter?.length ? `GÖNDERİLEN ÖN YAZI\n${input.coverLetter.join("\n\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function generateFormAnswer(llm: LlmProvider, input: FormAnswerInput): Promise<ExtractResult<FormAnswer>> {
  const source = formSource(input)
  const limitLine = input.limit ? `SINIR: en fazla ${input.limit.max} ${UNIT_LABEL[input.limit.unit]}` : null
  const language = questionLanguage(input.question) === "en" ? "İngilizce" : "Türkçe"
  const base = [source, `İLAN\n${postingSummary(input.posting)}`, `SORU\n${input.question.trim()}`, `YANIT DİLİ: ${language}`, limitLine]
    .filter(Boolean)
    .join("\n\n")

  const ask = async (extra: string | null) => {
    const r = await llm.extract({
      prompt: FORM_ANSWER_PROMPT,
      schemaName: "form_answer",
      schema: answerJsonSchema,
      input: extra ? `${base}\n\n${extra}` : base,
    })
    return { text: AnswerSchema.parse(r.data).yanit.trim(), tokens: r.tokens }
  }

  let { text, tokens } = await ask(null)
  let overLimit = false
  if (input.limit && measure(text, input.limit.unit) > input.limit.max) {
    const size = measure(text, input.limit.unit)
    const retry = await ask(
      `ÖNCEKİ YANITIN ${size} ${UNIT_LABEL[input.limit.unit]}, SINIR ${input.limit.max}. Aynı içerikten daha kısa bir yanıt yaz:\n${text}`,
    )
    tokens += retry.tokens
    text = retry.text
    if (measure(text, input.limit.unit) > input.limit.max) {
      const cut = cutToLimit(text, input.limit)
      if (cut) text = cut
      else overLimit = true
    }
  }

  const [checked] = verifyCoverLetter([text], source, input.posting)
  return { data: { text, verification: checked!.verification, overLimit }, tokens }
}
