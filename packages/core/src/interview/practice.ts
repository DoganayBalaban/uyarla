import { z } from "zod"
import { resumeFacts } from "../cover/letter.js"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { checkPostingTermInjection } from "../verify/injection.js"
import { withoutNegatedClauses } from "../verify/negation.js"
import { checkNumbers } from "../verify/numbers.js"

/**
 * Yazılı mülakat pratiği (DOG-97). Kullanıcı hazırlık paketindeki bir soruya
 * cevap yazıyor; geri bildirim cevabın kendisine dayanıyor.
 *
 *   - STAR: dört parçadan hangileri var (model).
 *   - Güçlü yanlar ve geliştirme önerileri (model). Öneri yeni olgu
 *     getirmiyor ("şunu yaptığını söyle" yok); soru ya da yapı önerisi.
 *   - Kağıtta yok (kod): cevapta geçen ama CV'de olmayan sayı ya da ilan
 *     terimi. Hata değil, hatırlatma: mülakatta sorulursa kanıtlayabilmeli.
 *   - Uzunluk (kod): sesli 1–2 dakika, 80–250 kelime.
 */
export const PRACTICE_PROMPT = `Sana bir mülakat sorusu, adayın bu soruya YAZDIĞI cevap ve adayın CV'si
verilecek. Cevaba kısa, yapıcı bir geri bildirim ver.

Kesin kurallar:
- Değerlendirmeyi yalnızca adayın cevabına dayandır.
- Adaya yeni bir olgu, sayı, araç ya da deneyim ÖNERME; "şunu yaptığını
  söyle" deme. Geliştirme önerileri soru ya da yapı önerisi olsun
  ("sonucu bir sayıyla anlatabilir misin?", "önce durumu bir cümleyle kur").
- Klişe ve abartılı övgü yok. Kısa ve somut ol.
- Türkçe yaz; "sen" dili.

İstenen:
- star: cevapta bu parçalar var mı? durum (bağlam), gorev (adayın sorumluluğu),
  eylem (adayın kendisinin ne yaptığı), sonuc (ne oldu, tercihen ölçülebilir).
- guclu: cevabın en çok 2 güçlü yanı; yoksa boş.
- gelistir: en çok 3 geliştirme önerisi.`

const ReviewSchema = z.object({
  star: z.object({ durum: z.boolean(), gorev: z.boolean(), eylem: z.boolean(), sonuc: z.boolean() }),
  guclu: z.array(z.string()),
  gelistir: z.array(z.string()),
})
const reviewJsonSchema = toJsonSchema(ReviewSchema)

export * from "./practiceRecord.js"
import { ANSWER_MAX_WORDS, ANSWER_MIN_WORDS, type PracticeFeedback } from "./practiceRecord.js"

export interface PracticeInput {
  question: string
  answer: string
  profile: ResumeProfile
  coverLetter?: string[]
  posting: JobPostingData
}

/**
 * "Kağıtta yok" (kod): olumsuzlanan yan cümleler hariç sayı ve ilan terimi.
 * Kişisel nitelik ve şartlar sayılmıyor: "dikkatli", "ehliyet" kağıtla
 * kanıtlanan bir iddia değil.
 */
export function offPaperClaims(answer: string, source: string, posting: JobPostingData): string[] {
  const claim = withoutNegatedClauses(answer)
  const skills = { ...posting, requirements: posting.requirements.filter((r) => r.type !== "soft" && r.type !== "condition") }
  return [...checkNumbers(claim, source), ...checkPostingTermInjection(claim, source, skills)].map((i) =>
    i.detail
      .replace(/^Bu maddede /, "Cevabında ")
      .replace("senin yazdığın hâlinde yok.", "CV'nde yok; sorulursa kanıtlayabilmelisin."),
  )
}

export async function reviewAnswer(llm: LlmProvider, input: PracticeInput): Promise<ExtractResult<PracticeFeedback>> {
  const source = [`CV\n${resumeFacts(input.profile)}`, input.coverLetter?.length ? `ÖN YAZI\n${input.coverLetter.join("\n\n")}` : null]
    .filter(Boolean)
    .join("\n\n")
  const { data, tokens } = await llm.extract({
    prompt: PRACTICE_PROMPT,
    schemaName: "practice_review",
    schema: reviewJsonSchema,
    input: `SORU\n${input.question}\n\nADAYIN CEVABI\n${input.answer.trim()}\n\n${source}`,
  })
  const parsed = ReviewSchema.parse(data)
  const words = input.answer.split(/\s+/).filter(Boolean).length
  return {
    data: {
      star: { situation: parsed.star.durum, task: parsed.star.gorev, action: parsed.star.eylem, result: parsed.star.sonuc },
      strengths: parsed.guclu.map((s) => s.trim()).filter(Boolean).slice(0, 2),
      improvements: parsed.gelistir.map((s) => s.trim()).filter(Boolean).slice(0, 3),
      words,
      length: words < ANSWER_MIN_WORDS ? "short" : words > ANSWER_MAX_WORDS ? "long" : "ok",
      offPaper: offPaperClaims(input.answer, source, input.posting),
    },
    tokens,
  }
}
