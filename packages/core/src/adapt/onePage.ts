import { toDocumentModel, type DocumentModel } from "../document/model.js"
import { pdfPageCount } from "../document/pdf.js"
import { cosineSimilarity } from "../llm/embedding.js"
import type { EmbeddingProvider } from "../llm/types.js"
import { resumeLanguage } from "../normalize/language.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { conceptTexts } from "../score/score.js"
import { applyAdaptation } from "./profile.js"
import { rescore } from "./rescore.js"

export interface OnePagePlan {
  /** Plan belgeyi tek sayfaya indirebildi mi. */
  fits: boolean
  /** Sıkı yerleşimde sayfa sayısı, çıkarılanlar olmadan. */
  pagesBefore: number
  /** Planla birlikte sayfa sayısı. */
  pages: number
  /** Çıkarılması önerilen madde kimlikleri, çıkarılma sırasıyla. */
  omitted: string[]
  /** Plan öncesi ve sonrası skor; plan skoru düşürmüyor. */
  scoreBefore: number
  scoreAfter: number
}

/**
 * Tek sayfa stratejisi (DOG-93). Jobscan'deki "sıkıştır"ın karşılığı, ama
 * skoru düşürmeden.
 *
 * Önce sıkı yerleşim deneniyor (document/pdf.ts, compact); değerlendirme
 * CV'lerinden ikisi bununla tek sayfaya iniyor. Yetmezse maddeler ilana
 * en az benzeyeninden başlayarak çıkarılıyor:
 *   - Çıkarılınca skoru düşüren madde bir gereksinimin kanıtıdır; kalıyor.
 *   - Bir işin son maddesi kalıyor; başlık maddesiz kalmasın.
 *   - Belge tek sayfaya inince duruluyor.
 * Hiçbir şey yazılmıyor ya da kısaltılmıyor, yalnızca çıkarılıyor; uydurma
 * riski yok. Plan bir öneri: kullanıcı her maddeyi geri alabilir.
 *
 * `toModel` indirmenin kurduğu belgeyle aynı olmalı (iletişim satırı, eğitim
 * sırası); sayfa sayısı ona göre ölçülüyor.
 */
export async function planOnePage(
  input: {
    profile: ResumeProfile
    posting: JobPostingData
    draft: AdaptationDraft
    toModel?: (profile: ResumeProfile) => DocumentModel
  },
  embedding: EmbeddingProvider,
): Promise<OnePagePlan> {
  const toModel = input.toModel ?? ((p: ResumeProfile) => toDocumentModel(p))
  const withOmitted = (omitted: string[]): AdaptationDraft => ({ ...input.draft, omitted })
  const pagesOf = (omitted: string[]) =>
    pdfPageCount(toModel(applyAdaptation(input.profile, withOmitted(omitted))), { compact: true })
  const scoreOf = (omitted: string[]) =>
    rescore({ profile: input.profile, posting: input.posting, draft: withOmitted(omitted) }, embedding)

  const pagesBefore = await pagesOf([])
  const scoreBefore = await scoreOf([])
  if (pagesBefore <= 1) {
    return { fits: true, pagesBefore, pages: pagesBefore, omitted: [], scoreBefore, scoreAfter: scoreBefore }
  }

  // Maddelerin belgedeki hâli: kabul edilen yeniden yazım, yoksa özgün metin.
  const texts = input.draft.bullets.map((b) => (b.decision === "accepted" ? b.rewritten : b.original))
  const concepts = conceptTexts(input.posting, resumeLanguage(input.profile))
  const vectors = await embedding.embed([...texts, ...concepts])
  const conceptVectors = vectors.slice(texts.length)
  const relevance = input.draft.bullets.map((b, i) => ({
    id: b.id,
    entry: entryOf(b.id),
    score: Math.max(0, ...conceptVectors.map((c) => cosineSimilarity(vectors[i]!, c))),
  }))
  // En az ilgili önce; eşitlikte belgede sonra gelen (daha eski iş) önce.
  const candidates = relevance
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => a.score - b.score || b.i - a.i)

  const remaining = new Map<string, number>()
  for (const r of relevance) remaining.set(r.entry, (remaining.get(r.entry) ?? 0) + 1)

  let omitted: string[] = []
  let pages = pagesBefore
  for (const candidate of candidates) {
    if ((remaining.get(candidate.entry) ?? 0) <= 1) continue
    const trial = [...omitted, candidate.id]
    if ((await scoreOf(trial)) < scoreBefore) continue
    omitted = trial
    remaining.set(candidate.entry, remaining.get(candidate.entry)! - 1)
    pages = await pagesOf(omitted)
    if (pages <= 1) break
  }

  return { fits: pages <= 1, pagesBefore, pages, omitted, scoreBefore, scoreAfter: await scoreOf(omitted) }
}

/** Maddenin ait olduğu kayıt: "2-3" → "2", "p1-0" → "p1". */
function entryOf(bulletId: string): string {
  return bulletId.slice(0, bulletId.lastIndexOf("-"))
}
