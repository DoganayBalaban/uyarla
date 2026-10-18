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

/** Proje maddesinin kimliği (DOG-105); deneyim kimlikleriyle çakışmasın diye "p" önekli. */
export function projectBulletId(projectIndex: number, bulletIndex: number): string {
  return `p${projectIndex}-${bulletIndex}`
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
  // Tek sayfa için çıkarılan maddeler (DOG-93). Kimlik konumdan geldiği için
  // süzme, kimlik eşlendikten sonra yapılıyor.
  const omitted = new Set(draft.omitted ?? [])

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
      bullets: [
        ...job.bullets.flatMap((bullet, j) =>
          omitted.has(bulletId(i, j))
            ? []
            : [
                {
                  ...bullet,
                  text: accepted.get(bulletId(i, j)) ?? bullet.text,
                  // sourceRef asla değişmez: doğrulamanın tek kaynağı bu.
                },
              ],
        ),
        // Kullanıcının anlattığı deneyimden yazılanlar o işin sonuna (DOG-94).
        // Dayanak kullanıcının cevabı; sourceRef olarak o saklanıyor.
        ...(draft.contributions ?? [])
          .filter((c) => c.experienceIndex === i && c.status === "done" && c.decision === "accepted" && c.text)
          .map((c) => ({ text: c.text!, sourceRef: c.answer })),
      ],
    })),
    // Projelerin maddeleri de deneyim maddeleri gibi uyarlanıyor (DOG-105).
    ...(profile.projects
      ? {
          projects: profile.projects.map((project, i) => ({
            ...project,
            bullets: project.bullets.flatMap((bullet, j) =>
              omitted.has(projectBulletId(i, j))
                ? []
                : [{ ...bullet, text: accepted.get(projectBulletId(i, j)) ?? bullet.text }],
            ),
          })),
        }
      : {}),
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
