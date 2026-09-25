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
  const kabulEdilenler = new Map(
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
        text: kabulEdilenler.get(bulletId(i, j)) ?? bullet.text,
        // sourceRef asla değişmez: doğrulamanın tek kaynağı bu.
      })),
    })),
    skills: sirala(profile.skills, draft.skillOrder),
    // Eğitim, diller ve sertifikalar dokunulmadan geçer (spec §6.4).
  }
}

/**
 * Becerileri verilen sıraya dizer; sırada geçmeyenler sonda, özgün
 * sıralarıyla kalır. Küme değişmez (K-27).
 */
function sirala(skills: string[], order: string[]): string[] {
  const sira = new Map(order.map((beceri, i) => [beceri, i]))
  return skills
    .map((beceri, i) => ({ beceri, i, sira: sira.get(beceri) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.sira - b.sira || a.i - b.i)
    .map((x) => x.beceri)
}
