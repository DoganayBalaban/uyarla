import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { resumeFacts, verifyCoverLetter } from "./letter.js"

/**
 * Takip mesajı ve teşekkür notu taslağı (DOG-117). ai-job-search'ün
 * `/outcome followup` kuralı: taslağın her iddiası gönderilen CV'den ve ön
 * yazıdan geliyor, yeni iddia yok. Biz göndermiyoruz; kullanıcı kopyalıyor.
 *
 * Kaynak, başvurunun gönderilen hâli: uyarlama varsa uyarlanmış CV ve ön
 * yazı, yoksa özgün CV. Doğrulama ön yazıyla aynı (sayı ve ilan terimi,
 * dürüst köprü ve unvan hariç; K-76).
 *
 * Teşekkür notunda görüşmede ne konuşulduğunu bilmiyoruz. Model bir konu
 * uydurmasın diye köşeli parantezli bir yer tutucu bırakıyor; kullanıcı
 * dolduruyor ya da siliyor.
 */
export type { FollowUpChannel, FollowUpKind, OutreachPurpose, OutreachRecipient } from "./followUpRecord.js"
import type { FollowUpChannel, FollowUpKind, OutreachPurpose, OutreachRecipient } from "./followUpRecord.js"

export {
  MAX_FOLLOW_UPS_PER_KIND,
  OUTREACH_NOTE_MAX_LENGTH,
  FollowUpRecordSchema,
  readFollowUps,
  type FollowUpRecord,
} from "./followUpRecord.js"

export const FOLLOW_UP_PROMPT = `Sana bir adayın bir iş başvurusunda GÖNDERDİĞİ belgeler (CV ve varsa ön yazı)
ve başvurduğu ilan verilecek. Adayın işverene göndereceği kısa bir mesajın
taslağını yaz. Mesajı aday gönderecek.

Kesin kurallar:
- YALNIZCA gönderilen belgelerde yazan deneyim, beceri ve sayıları kullan. Yeni
  bir deneyim, beceri, sayı, sonuç ya da iddia EKLEME; belgelerde olmayan bir
  şeyi ima etme.
- İlanın istediği ama belgelerde olmayan bir şeyden bahsetme.
- Baskı kurma, özür dileme, yalvarma. Klişe kullanma ("takım oyuncusu",
  "dinamik", "motivasyonu yüksek", "öğrenmeye açığım").
- Metnin ve konu satırının TAMAMI girdideki "Dil" satırında yazan dilde olsun;
  dilleri karıştırma. Türkçe ise resmi "siz" dili kullan.

Tür:
- "takip": başvurudan bir süre sonra cevap gelmemiş. Başvurduğu pozisyonu ve
  başvuru tarihini an, ilgisini kısaca yinele, belgelerden ilanla en ilgili
  TEK bir noktayı hatırlat, süreç hakkında bilgi rica et. 40–100 kelime.
- "teşekkür": mülakattan sonra. Görüşme için teşekkür et, pozisyona ilgisini
  yinele, belgelerden ilanla en ilgili TEK bir noktayı an. Görüşmede ne
  konuşulduğunu BİLMİYORSUN: bir konu uydurma; onun yerine metne aynen
  "[görüşmede konuşulan bir konu]" yer tutucusunu koy. 50–100 kelime.
- "ağ kurma": başvurmadan önce ya da başvurduktan sonra şirketten birine ilk
  kez yazıyor (DOG-99). Alıcının adını BİLMİYORSUN: hitapta adın yerine aynen
  "[ad]" yaz ("Merhaba [ad],"). "BAŞVURU: henüz yapılmadı" ise başvurduğunu
  YAZMA. "ALICI" ve "AMAÇ" satırlarına göre yaz; tek
  bir somut deneyim an, tek bir açık ve küçük istekle bitir. "BAĞLAM" satırı
  varsa onu bir cümleyle kullan; yoksa ortak bir geçmiş, tanışıklık ya da
  ilgi UYDURMA. İş isteme, iltifat etme. 50–100 kelime.

Kanal:
- "e-posta": "konu" alanına kısa bir konu satırı yaz. Metin hitapla başlasın
  (Türkçe "Merhaba,", İngilizce "Hello,") ve adayın adıyla bitsin (ad yoksa
  imzasız).
- "linkedin": "konu" null. 2–4 cümle, en çok 80 kelime; aynı hitap, imza yok.`

const FollowUpSchema = z.object({ konu: z.string().nullable(), metin: z.string() })
const followUpJsonSchema = toJsonSchema(FollowUpSchema)

const KIND_LABEL: Record<FollowUpKind, string> = { followup: "takip", thanks: "teşekkür", outreach: "ağ kurma" }
const RECIPIENT_LABEL: Record<OutreachRecipient, string> = {
  recruiter: "işe alım sorumlusu",
  team: "pozisyonun ekibinden biri (ör. yönetici)",
  contact: "şirkette çalışan bir tanıdık ya da ortak bağlantı",
}
const PURPOSE_LABEL: Record<OutreachPurpose, string> = {
  introduce: "ilgisini ve başvurusunu kısaca iletmek",
  ask: "pozisyon ya da süreç hakkında bir soru sormak",
  chat: "rol hakkında kısa bir görüşme rica etmek",
}
const CHANNEL_LABEL: Record<FollowUpChannel, string> = { email: "e-posta", linkedin: "linkedin" }
const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })

export interface FollowUpInput {
  /** Gönderilen CV: uyarlama varsa uyarlanmış hâli. */
  profile: ResumeProfile
  /** Gönderilen ön yazının paragrafları; yoksa boş. */
  coverLetter?: string[]
  posting: JobPostingData
  kind: FollowUpKind
  channel: FollowUpChannel
  /** "YYYY-AA-GG"; takipte başvuru, teşekkürde mülakat günü. */
  date?: string | null
  /** Ağ kurma mesajında (DOG-99). */
  recipient?: OutreachRecipient
  purpose?: OutreachPurpose
  /** Kullanıcının verdiği bağlam; kaynağa giriyor, uydurma sayılmıyor. */
  note?: string | null
  /** Ağ kurma mesajında: başvuru yapıldı mı. Yapılmadıysa "başvurdum" yazılmaz. */
  applied?: boolean
}

export interface FollowUpDraft {
  subject: string | null
  text: string
  verification: Verification
}

/**
 * Kontrolün kaynağı: gönderilen belgeler ve bizim verdiğimiz tarih. Tarih
 * kaynağa girmezse "10 Ekim'de başvurdum" cümlesindeki sayı uydurma sayılırdı.
 */
export function followUpSource(input: FollowUpInput): string {
  const date = input.date ? DATE.format(new Date(`${input.date}T00:00:00Z`)) : null
  return [
    `GÖNDERİLEN CV\n${resumeFacts(input.profile)}`,
    input.coverLetter?.length ? `GÖNDERİLEN ÖN YAZI\n${input.coverLetter.join("\n\n")}` : null,
    date ? `${input.kind === "thanks" ? "Mülakat" : "Başvuru"} tarihi: ${date}` : null,
    input.kind === "outreach" && input.note?.trim() ? `ADAYIN VERDİĞİ BAĞLAM\n${input.note.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function generateFollowUp(llm: LlmProvider, input: FollowUpInput): Promise<ExtractResult<FollowUpDraft>> {
  const source = followUpSource(input)
  const { data, tokens } = await llm.extract({
    prompt: FOLLOW_UP_PROMPT,
    schemaName: "follow_up",
    schema: followUpJsonSchema,
    input: [
      source,
      `İLAN\nPozisyon: ${input.posting.position}${input.posting.company ? `\nŞirket: ${input.posting.company}` : ""}\nDil: ${input.posting.language === "en" ? "İngilizce" : "Türkçe"}`,
      [
        `TÜR: ${KIND_LABEL[input.kind]}`,
        `KANAL: ${CHANNEL_LABEL[input.channel]}`,
        input.kind === "outreach" ? `ALICI: ${RECIPIENT_LABEL[input.recipient ?? "recruiter"]}` : null,
        input.kind === "outreach" ? `AMAÇ: ${PURPOSE_LABEL[input.purpose ?? "introduce"]}` : null,
        input.kind === "outreach" ? `BAŞVURU: ${input.applied ? "yapıldı" : "henüz yapılmadı"}` : null,
        input.kind === "outreach" && input.note?.trim() ? `BAĞLAM: ${input.note.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ].join("\n\n"),
  })
  const parsed = FollowUpSchema.parse(data)
  const text = parsed.metin.trim()
  // Ön yazıyla aynı kontrol; tek paragraf gibi bakılıyor.
  const [checked] = verifyCoverLetter([text], source, input.posting)
  return {
    data: {
      subject: input.channel === "email" ? parsed.konu?.trim() || null : null,
      text,
      verification: checked!.verification,
    },
    tokens,
  }
}
