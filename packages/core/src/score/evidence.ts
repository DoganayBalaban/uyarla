import type { ResumeProfile } from "../schemas/resume.js"

/**
 * Eşleştirmenin ve kullanıcıya gösterilecek kanıtın birimi.
 *
 * CV bütün olarak değil, madde düzeyinde gömülüyor (spec §7): kullanıcıya
 * "bu gereksinimi şu maddeniz karşılıyor" diyebilmek için eşleştirmenin de
 * madde düzeyinde olması gerekiyor.
 */
export interface Evidence {
  /**
   * Gömülecek ve kullanıcıya gösterilecek metin. Deneyim maddelerinde unvan
   * ve kurum bağlamını taşır: "panel geliştirdi" tek başına hangi rolde
   * yapıldığını anlatmaz ve anlamsal eşleşme zayıflar.
   */
  text: string
  /**
   * Tam kelime eşleşmesinin bakacağı metin — bağlam ön eki OLMADAN.
   *
   * Ayrı olmasının sebebi somut: unvan ön eki her maddenin başında
   * tekrarlandığı için, unvana denk gelen bir anahtar kelime CV'deki tüm
   * maddelerle eşleşiyor ve kanıt olarak rastgele biri gösteriliyordu.
   * Unvan artık kendi kanıt kaydına sahip (kind: "role"); gerçekten unvan
   * eşleştiğinde kullanıcıya unvan gösterilir.
   */
  matchText: string
  kind: "role" | "bullet" | "skill" | "education"
  /** Ham CV metnindeki karşılığı; Sprint 2 uydurma kontrolü için. */
  sourceRef: string | null
}

export function collectEvidence(profile: ResumeProfile): Evidence[] {
  const evidence: Evidence[] = []

  for (const job of profile.experience) {
    const rol = `${job.title} · ${job.company}`

    // Unvan kendi başına kanıttır: ilan "React geliştirici" arıyorsa ve
    // adayın unvanı buysa, bu maddelerden bağımsız bir kanıttır.
    evidence.push({ text: rol, matchText: rol, kind: "role", sourceRef: null })

    for (const bullet of job.bullets) {
      evidence.push({
        text: `${rol}: ${bullet.text}`,
        matchText: bullet.text,
        kind: "bullet",
        sourceRef: bullet.sourceRef,
      })
    }
  }

  for (const skill of profile.skills) {
    evidence.push({ text: skill, matchText: skill, kind: "skill", sourceRef: null })
  }

  for (const edu of profile.education) {
    const metin = [edu.school, edu.degree, edu.field].filter(Boolean).join(", ")
    evidence.push({ text: metin, matchText: metin, kind: "education", sourceRef: null })
  }

  return evidence
}
