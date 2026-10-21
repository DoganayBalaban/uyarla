import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { jobBullets } from "./bullets.js"
import { projectBulletId } from "./ids.js"

// Kimlikler ayrı modülde: bullets.ts de kullanıyor ve döngüsel içe aktarma olmasın.
export { bulletId, projectBulletId } from "./ids.js"

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
  // Tek sayfa için çıkarılan (DOG-93) ve kullanıcının kaldırdığı (DOG-92)
  // proje maddeleri. Kimlik konumdan geldiği için süzme eşlemeden sonra.
  const dropped = new Set([...(draft.omitted ?? []), ...(draft.removed ?? [])])

  return {
    ...profile,
    // Başlık satırını yalnızca kullanıcı düzenliyor (DOG-92); unvan eşleşmesi
    // de bununla hesaplanıyor.
    headline: draft.headline?.text ?? profile.headline,
    // Boş yeniden yazım özetsiz CV'de oluyor (original null); onu kabul
    // etmek null özeti "" yapar ve belgede boş bir özet başlığı çıkar.
    summary:
      draft.summary.decision === "accepted" && draft.summary.rewritten.trim()
        ? draft.summary.rewritten
        : draft.summary.original,
    // Maddeler tek yerden (DOG-92): kabul edilen yeniden yazımlar, katkılar,
    // kullanıcının eklediği maddeler; kullanıcı sırası, kaldırılanlar ve tek
    // sayfa için çıkarılanlar düşmüş. Belge görünümü de aynı listeyi kullanıyor.
    experience: profile.experience.map((job, i) => ({
      ...job,
      bullets: jobBullets(profile, draft, i)
        .filter((b) => !b.omitted && !b.removed)
        .map(({ text, sourceRef }) => ({ text, sourceRef })),
    })),
    // Projelerin maddeleri de deneyim maddeleri gibi uyarlanıyor (DOG-105).
    ...(profile.projects
      ? {
          projects: profile.projects.map((project, i) => ({
            ...project,
            bullets: project.bullets.flatMap((bullet, j) =>
              dropped.has(projectBulletId(i, j))
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
