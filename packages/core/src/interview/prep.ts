import { z } from "zod"
import { verifyCoverLetter, resumeFacts } from "../cover/letter.js"
import { hasQuantity } from "../format/measurable.js"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { normalizeText } from "../normalize/turkish.js"
import { withoutNegatedClauses } from "../verify/negation.js"
import type { Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"

/**
 * Mülakat hazırlık paketi (DOG-118, ilk adım). ai-job-search `/interview`:
 * "kağıtta olmayan iddia odada yok; kağıttaki her iddia derinlemesine
 * savunulabilir." Kaynak başvurunun gönderilen CV'si ve ön yazısı.
 *
 * Bölümler:
 *   - Olası sorular: her biri için CV'den BİREBİR maddeler (kanıt) ve bir
 *     STAR iskeleti. CV'de olmayan kısım köşeli parantezli yer tutucu;
 *     kullanıcı kendi bildiğiyle dolduruyor. Kanıt maddesi CV'de birebir yoksa
 *     düşürülüyor.
 *   - Tutarlılık özeti (kodda, LLM yok): görüşmecinin üstüne gideceği
 *     iddialar. Sayı taşıyan maddeler ve uyarlamada yeniden yazılan maddeler.
 *   - Eksik zorunlu gereksinimlere dürüst köprü cevabı (K-76).
 *   - Adayın sorabileceği sorular.
 * STAR metinleri ve köprüler ön yazıyla aynı doğrulamadan geçiyor.
 */
export const INTERVIEW_PREP_PROMPT = `Sana bir adayın bir iş başvurusunda GÖNDERDİĞİ belgeler (CV ve varsa ön yazı),
başvurduğu ilan ve ilanın CV'de karşılığı olmayan zorunlu gereksinimleri
verilecek. Aday bu iş için mülakata çağrıldı. Ona bir hazırlık paketi hazırla.

Kesin kurallar:
- YALNIZCA gönderilen belgelerde yazanları kullan. Belgelerde olmayan bir
  deneyim, sayı, sonuç ya da sorumluluk EKLEME.
- Adayın planları, niyetleri, aldığı ya da alacağı eğitimler, "öğreniyorum",
  "araştırıyorum", "kursa katılıyorum" gibi cümleler de birer iddiadır;
  belgelerde yoksa YAZMA.
- STAR alanlarında (durum, görev, eylem, sonuç) belgede karşılığı olmayan
  kısmı uydurma; onun yerine köşeli parantezli bir yer tutucu yaz
  (ör. "[ekip büyüklüğü]", "[ölçülen sonuç]"). Aday kendi bildiğiyle dolduracak.
  "bosluk" sorusunda belgede karşılık yoksa dört alan da yer tutucu olsun;
  cevabın kendisi "kopruler"de.
- "kanit" listesine CV'de "•" ile başlayan ilgili MADDE satırlarını, madde
  işareti olmadan HARFİ HARFİNE kopyala (en çok 2). İş başlığı, tarih ya da
  beceri satırı kanıt değildir. İlgili madde yoksa listeyi boş bırak.
- Klişe ve abartı yok.
- Dil: girdideki "Dil" satırında yazan dil. Türkçe ise "siz" değil "sen" dili
  (aday kendisi okuyacak).

İstenen:
- sorular: 6–8 olası mülakat sorusu. tur: "teknik" (ilanın teknik
  gereksinimleri), "davranissal" (deneyim örneği isteyen), "bosluk" (CV'de
  zayıf ya da eksik kalan bir konuyu soracaklar). neden: bu sorunun neden
  sorulacağı, tek cümle.
- kopruler: verilen her eksik zorunlu gereksinim için dürüst bir cevap
  önerisi. Gereksinimi SAHİPLENME; doğrudan deneyimin olmadığını söyle ve
  belgelerdeki en yakın deneyimi anlat ("X ile doğrudan çalışmadım; Y'de …
  yaptım"). Belgede olmayan bir süre, sayı ya da öğrenme planı yazma. Liste
  boşsa boş dön.
- sorulacaklar: adayın görüşmenin sonunda sorabileceği 3 soru; ilana özel,
  ilanda zaten cevabı yazan bir şeyi sorma.`

const PrepSchema = z.object({
  sorular: z.array(
    z.object({
      soru: z.string(),
      tur: z.enum(["teknik", "davranissal", "bosluk"]),
      neden: z.string(),
      kanit: z.array(z.string()),
      star: z.object({ durum: z.string(), gorev: z.string(), eylem: z.string(), sonuc: z.string() }),
    }),
  ),
  kopruler: z.array(z.object({ gereksinim: z.string(), cevap: z.string() })),
  sorulacaklar: z.array(z.string()),
})
const prepJsonSchema = toJsonSchema(PrepSchema)

export interface PrepQuestion {
  question: string
  kind: "technical" | "behavioral" | "gap"
  why: string
  /** CV'deki maddeler, birebir. */
  evidence: string[]
  star: { situation: string; task: string; action: string; result: string }
  verification: Verification
}

export interface ConsistencyItem {
  /** CV'deki madde. */
  claim: string
  reason: "quantity" | "rewritten"
}

export interface InterviewPrep {
  questions: PrepQuestion[]
  consistency: ConsistencyItem[]
  bridges: Array<{ requirement: string; answer: string; verification: Verification }>
  askThem: string[]
}

/** `Analysis.interviewPrep` kaydı. Yeniden yazma bir kez: iki deneme. */
export const MAX_PREP_ATTEMPTS = 2

export { MAX_PRACTICE_PER_QUESTION, type PracticeEntry } from "./practiceRecord.js"
import type { PracticeEntry } from "./practiceRecord.js"

/**
 * Hazırlık paketinin o anki adımı (DOG-136); worker yazıyor. Yoksa ilk adım:
 * gönderilen belgeler okunuyor.
 */
export type InterviewPrepStage = "reading" | "writing"

export type InterviewPrepRecord = (
  | { status: "running"; createdAt: string; attempts: number; prep?: InterviewPrep; stage?: InterviewPrepStage }
  | { status: "failed"; createdAt: string; attempts: number; prep?: InterviewPrep }
  | { status: "done"; createdAt: string; attempts: number; prep: InterviewPrep }
) & { practice?: PracticeEntry[] }

export interface InterviewPrepInput {
  /** Gönderilen CV: uyarlama varsa kabul edilenlerle. */
  profile: ResumeProfile
  coverLetter?: string[]
  posting: JobPostingData
  /** CV'de karşılığı olmayan zorunlu gereksinimlerin metni. */
  missingMust: string[]
  /** Uyarlamada yeniden yazılıp kabul edilen maddeler (tutarlılık özeti için). */
  rewritten?: string[]
}

const KIND: Record<"teknik" | "davranissal" | "bosluk", PrepQuestion["kind"]> = {
  teknik: "technical",
  davranissal: "behavioral",
  bosluk: "gap",
}

function bulletList(profile: ResumeProfile) {
  return [...profile.experience.flatMap((j) => j.bullets), ...(profile.projects ?? []).flatMap((p) => p.bullets)]
}

function bullets(profile: ResumeProfile): string[] {
  return bulletList(profile).map((b) => b.text)
}

/**
 * Tutarlılık özeti (kodda): sayı taşıyan maddeler ("bunu nasıl ölçtün?") ve
 * uyarlamada yeniden yazılanlar ("kendi kelimelerinle anlatabilmelisin").
 * En çok 6; önce yeniden yazılanlar.
 */
export function consistencySummary(profile: ResumeProfile, rewritten: string[] = []): ConsistencyItem[] {
  const all = bullets(profile)
  const keys = new Set(all.map(normalizeText))
  const items: ConsistencyItem[] = []
  const seen = new Set<string>()
  for (const r of rewritten) {
    const k = normalizeText(r)
    if (!keys.has(k) || seen.has(k)) continue
    seen.add(k)
    items.push({ claim: r, reason: "rewritten" })
  }
  for (const b of all) {
    const k = normalizeText(b)
    if (seen.has(k) || !hasQuantity(b)) continue
    seen.add(k)
    items.push({ claim: b, reason: "quantity" })
  }
  return items.slice(0, 6)
}

export async function generateInterviewPrep(llm: LlmProvider, input: InterviewPrepInput): Promise<ExtractResult<InterviewPrep>> {
  const source = [
    `GÖNDERİLEN CV\n${resumeFacts(input.profile)}`,
    input.coverLetter?.length ? `GÖNDERİLEN ÖN YAZI\n${input.coverLetter.join("\n\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")
  const { data, tokens } = await llm.extract({
    prompt: INTERVIEW_PREP_PROMPT,
    schemaName: "interview_prep",
    schema: prepJsonSchema,
    input: [
      source,
      `İLAN\nPozisyon: ${input.posting.position}${input.posting.company ? `\nŞirket: ${input.posting.company}` : ""}\nDil: ${input.posting.language === "en" ? "İngilizce" : "Türkçe"}\nGereksinimler:\n- ${input.posting.requirements.filter((r) => r.type !== "condition").map((r) => r.text).join("\n- ")}`,
      `CV'DE KARŞILIĞI OLMAYAN ZORUNLU GEREKSİNİMLER\n${input.missingMust.length ? `- ${input.missingMust.join("\n- ")}` : "(yok)"}`,
    ].join("\n\n"),
  })
  const parsed = PrepSchema.parse(data)

  // Kanıt: yalnızca CV'de birebir olan maddeler (normalleştirilmiş eşitlik).
  // Model maddeyi doğrulama kaynağındaki özgün metinden (sourceRef) de
  // kopyalayabiliyor; ikisi de tanınıyor, gösterilen maddenin kendisi.
  const byKey = new Map<string, string>()
  for (const b of bulletList(input.profile)) {
    byKey.set(normalizeText(b.text), b.text)
    if (b.sourceRef) byKey.set(normalizeText(b.sourceRef), b.text)
  }
  const verify = (text: string) => verifyCoverLetter([text], source, input.posting)[0]!.verification

  return {
    data: {
      questions: parsed.sorular.map((q) => ({
        question: q.soru.trim(),
        kind: KIND[q.tur],
        why: q.neden.trim(),
        evidence: [...new Set(q.kanit.map((k) => byKey.get(normalizeText(k))).filter((k): k is string => Boolean(k)))],
        star: { situation: q.star.durum.trim(), task: q.star.gorev.trim(), action: q.star.eylem.trim(), result: q.star.sonuc.trim() },
        verification: verify([q.star.durum, q.star.gorev, q.star.eylem, q.star.sonuc].join(" ")),
      })),
      consistency: consistencySummary(input.profile, input.rewritten),
      // Köprü gereksinimi olumsuzlayarak anabiliyor ("5 yıl deneyimim yok"):
      // olumsuzlanan yan cümle sayı kontrolünden de çıkıyor. "4 yıllık
      // deneyimim var" gibi bir iddia yine işaretleniyor.
      bridges: parsed.kopruler.map((b) => ({
        requirement: b.gereksinim.trim(),
        answer: b.cevap.trim(),
        verification: verify(withoutNegatedClauses(b.cevap)),
      })),
      askThem: parsed.sorulacaklar.map((s) => s.trim()).filter(Boolean).slice(0, 3),
    },
    tokens,
  }
}
