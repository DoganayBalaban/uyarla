import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"

/**
 * Bir maddenin kararlı kimliği.
 *
 * Kimlik konumdan türetiliyor: taslak ile profil aynı çıkarımdan geliyor ve
 * sıraları değişmiyor. Rastgele kimlik üretmek, taslağı profile geri
 * bağlamak için ayrı bir eşleme tablosu gerektirirdi.
 */
export function bulletId(experienceIndex: number, bulletIndex: number): string {
  return `${experienceIndex}-${bulletIndex}`
}

/**
 * Kabul edilen kararlardan yeni bir profil üretir (spec §10).
 *
 * Yalnızca `accepted` olanlar uygulanıyor: `rejected` kullanıcının hayır
 * dediği, `pending` ise henüz görmediği metin.
 *
 * Yeni LLM çağrısı yok — çıkarım zaten yapılmış, yalnızca kanıt kümesi
 * değişiyor. Sonuç Sprint 1'in skor servisine olduğu gibi verilebilir.
 */
export function applyAdaptation(
  profile: ResumeProfile,
  draft: AdaptationDraft,
): ResumeProfile {
  const accepted = new Map(
    draft.bullets.filter((b) => b.decision === "accepted").map((b) => [b.id, b.rewritten]),
  )

  return {
    ...profile,
    // Boş yeniden yazım özetsiz CV'de oluyor (original null); onu kabul
    // etmek null özeti "" yapar ve belgede boş bir özet başlığı çıkar.
    summary:
      draft.summary.decision === "accepted" && draft.summary.rewritten.trim()
        ? draft.summary.rewritten
        : draft.summary.original,
    experience: profile.experience.map((job, i) => ({
      ...job,
      bullets: job.bullets.map((bullet, j) => ({
        ...bullet,
        text: accepted.get(bulletId(i, j)) ?? bullet.text,
        // sourceRef asla değişmez: doğrulamanın tek kaynağı bu.
      })),
    })),
    // Eklenen beceriler adayın kendi maddelerinden geliyor (K-38).
    skills: sortItems([...profile.skills, ...(draft.addedSkills ?? [])], draft.skillOrder),
    // Eğitim, diller ve sertifikalar dokunulmadan geçer (spec §6.4).
  }
}

/**
 * Becerileri verilen sıraya dizer; sırada geçmeyenler sonda, özgün
 * sıralarıyla kalır. Küme değişmez (K-27).
 */
function sortItems(skills: string[], order: string[]): string[] {
  const orderIndex = new Map(order.map((skill, i) => [skill, i]))
  return skills
    .map((skill, i) => ({ skill, i, orderIndex: orderIndex.get(skill) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.i - b.i)
    .map((x) => x.skill)
}
