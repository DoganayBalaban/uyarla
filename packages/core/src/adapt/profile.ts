import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { groupBullets, jobBullets } from "./bullets.js"

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
  // Bölüm düzenlemeleri (DOG-92): gizlenen bölüm belgede ve skorda yok.
  const hidden = new Set(draft.sectionEdits?.hidden ?? [])
  const titles = draft.sectionEdits?.titles ?? {}
  const others = [
    ...(profile.otherSections ?? []).map((o, i) => ({ key: `o${i}`, ...o })),
    ...(draft.userSections ?? []).map(({ id, heading, lines }) => ({ key: id, heading, lines })),
  ]
    .filter((o) => !hidden.has(o.key))
    .map(({ key, heading, lines }) => ({ heading: titles[key] ?? heading, lines }))
  const structuredTitles = Object.fromEntries(
    (["experience", "projects", "education", "skills", "languages", "certifications"] as const)
      .filter((k) => titles[k])
      .map((k) => [k, titles[k]!]),
  )

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
    experience: hidden.has("experience")
      ? []
      : profile.experience.map((job, i) => ({
          ...job,
          bullets: jobBullets(profile, draft, i)
            .filter((b) => !b.omitted && !b.removed)
            .map(({ text, sourceRef }) => ({ text, sourceRef })),
        })),
    // Projelerin maddeleri de deneyim maddeleri gibi (DOG-105, DOG-92).
    ...(profile.projects
      ? {
          projects: hidden.has("projects")
            ? []
            : profile.projects.map((project, i) => ({
                ...project,
                bullets: groupBullets(profile, draft, { kind: "project", index: i })
                  .filter((b) => !b.omitted && !b.removed)
                  .map(({ text, sourceRef }) => ({ text, sourceRef })),
              })),
        }
      : {}),
    // Kullanıcının seçtiği bölüm sırası ve eklediği bölümler (DOG-92).
    ...(draft.sectionOrder ? { sectionOrder: draft.sectionOrder } : {}),
    // CV'nin kendi diğer bölümleri, sonra kullanıcınınkiler; gizlenenler düşmüş, adlar değişmiş.
    ...(profile.otherSections || others.length ? { otherSections: others } : {}),
    ...(Object.keys(structuredTitles).length ? { sectionTitles: structuredTitles } : {}),
    ...(hidden.has("education") ? { education: [] } : {}),
    // Eklenen beceriler adayın kendi maddelerinden geliyor (K-38).
    skills: hidden.has("skills") ? [] : sortItems([...profile.skills, ...(draft.addedSkills ?? [])], draft.skillOrder),
    ...(hidden.has("skills") ? { skillGroups: [] } : {}),
    // Diller ve sertifikalar dokunulmadan geçer (spec §6.4); yalnızca kullanıcı gizleyebilir.
    ...(hidden.has("languages") ? { languages: [] } : {}),
    ...(hidden.has("certifications") ? { certifications: [] } : {}),
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
