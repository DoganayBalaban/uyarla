import type { AdaptationDraft, Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { verifyRewrite } from "../verify/verify.js"
import { resumeText } from "./targets.js"

/**
 * Önerinin metnini elle düzenleme (DOG-92). Kullanıcı yeni hâli kendisi
 * yazıyor; o yüzden seçim "yeni hâli" oluyor. Kontrol yine kodda ve LLM'siz:
 * sayı ve ilan terimi CV'nin tamamına karşı. Kullanıcı CV'nin başka bir
 * yerindeki bir olguyu maddeye taşıyabilir; CV'de hiç olmayan bir sayı ya da
 * ilan terimi "kontrol et" uyarısı alıyor ama engellenmiyor: yazan kullanıcı.
 */
export const EDIT_MAX_LENGTH = 1000
/** Başlık satırı tek satır; LinkedIn başlığıyla aynı yönlendirme (DOG-69). */
export const HEADLINE_MAX_LENGTH = 160

const CLEAN: Verification = { status: "ok", issues: [] }

const normalize = (text: string) => text.replace(/\s+/g, " ").trim()

export function editDraftItem(
  draft: AdaptationDraft,
  itemId: string,
  text: string,
  context: { profile: ResumeProfile; posting: JobPostingData },
): AdaptationDraft {
  const value = normalize(text)
  if (!value) throw new Error("Boş metin")
  if (value.length > EDIT_MAX_LENGTH) throw new Error("Metin çok uzun")
  const verify = (original: string | null): Verification =>
    original !== null && value === normalize(original)
      ? CLEAN
      : verifyRewrite({ rewritten: value, source: resumeText(context.profile), posting: context.posting })

  if (itemId === "headline") {
    if (value.length > HEADLINE_MAX_LENGTH) throw new Error("Başlık çok uzun")
    const original = context.profile.headline
    // CV'nin kendi başlığına dönüş düzenlemeyi kaldırıyor.
    if (original !== null && value === normalize(original)) {
      const { headline: _headline, ...rest } = draft
      return rest
    }
    return { ...draft, headline: { text: value, verification: verify(null) } }
  }

  if (itemId === "summary") {
    if (!draft.summary.original) throw new Error("Özet yok")
    const back = value === normalize(draft.summary.original)
    return {
      ...draft,
      summary: { ...draft.summary, rewritten: value, verification: verify(draft.summary.original), decision: "accepted", edited: !back || undefined },
    }
  }

  const bullet = draft.bullets.find((b) => b.id === itemId)
  if (!bullet) throw new Error(`Madde bulunamadı: ${itemId}`)
  const back = value === normalize(bullet.original)
  const lower = value.toLocaleLowerCase("tr")
  return {
    ...draft,
    bullets: draft.bullets.map((b) =>
      b.id === itemId
        ? {
            ...b,
            rewritten: back ? b.original : value,
            verification: verify(b.original),
            // Metinde artık geçmeyen terimin dayanağı gösterilmiyor.
            alignments: back ? [] : (b.alignments ?? []).filter((a) => lower.includes(a.term.toLocaleLowerCase("tr"))),
            decision: "accepted",
            edited: !back || undefined,
          }
        : b,
    ),
  }
}
